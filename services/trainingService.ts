import {
    Card,
    RoundResult,
    FusionDecisionSample,
    TrainedModel,
    WeatherType,
    Winner,
    HeroName,
    TrainingAnalysis,
    TrainingRunOptions,
    GameHistoryEntry,
    ElementType,
    AbilityMechanicName,
    ContextInsight,
    TokenDeltaCoverage,
    HeroMatchupInsight,
    ElementCounterInsight,
    MechanicEffectivenessInsight,
    ResamplingRecommendation,
    ValueType,
    SerializedRunenkriegModel,
    RunenkriegContextMetadata,
    FusionInsight,
} from '../types';
import {
    ELEMENTS,
    ABILITIES,
    WEATHER_EFFECTS,
    ELEMENT_HIERARCHIE,
    HEROES,
    CARD_TYPES,
    ABILITY_MECHANICS,
    START_TOKENS,
    HAND_SIZE,
    ELEMENT_SYNERGIES,
} from '../constants';
import {
    evaluateElementSynergy,
    evaluateRiskAndWeather,
    resolveMechanicEffects,
} from './mechanicEngine';
import { buildShuffledDeck, getRandomCardTemplate } from './cardCatalogService';
import { computeWilsonStatsGpu } from './gpuAcceleration';

const WILSON_Z = 1.96;

const clampTokenDelta = (delta: number) => Math.max(-5, Math.min(5, delta));
const MAX_ROUNDS_PER_GAME = 200;

const parseCardLabel = (
    cardLabel: string
): { element: ElementType; ability: ValueType } => {
    const [element, ...abilityParts] = cardLabel.split(' ');
    return {
        element: element as ElementType,
        ability: abilityParts.join(' ') as ValueType,
    };
};

const createCardTemplate = (label: string, idSuffix: string): Card => {
    const { element, ability } = parseCardLabel(label);
    const elementIndex = ELEMENTS.indexOf(element);
    const abilityIndex = ABILITIES.indexOf(ability);
    const cardType = CARD_TYPES[(elementIndex + abilityIndex) % CARD_TYPES.length];

    return {
        element,
        wert: ability,
        id: `${element}-${ability}-${idSuffix}`,
        cardType: cardType.name,
        mechanics: ABILITY_MECHANICS[ability] || [],
        lifespan: cardType.defaultLifespan,
        charges: cardType.defaultCharges,
        origin: 'core',
    };
};

const abilityIndex = (value: ValueType) => ABILITIES.indexOf(value);

let fusionIdCounter = 0;
let generatedCardCounter = 0;

const determineFusionElement = (first: Card, second: Card): ElementType => {
    const synergy = ELEMENT_SYNERGIES.find(
        (entry) => entry.elements.includes(first.element) && entry.elements.includes(second.element)
    );

    if (synergy) {
        return first.element === synergy.elements[0] ? first.element : second.element;
    }

    return abilityIndex(first.wert) >= abilityIndex(second.wert) ? first.element : second.element;
};

const createFusionCard = (primary: Card, secondary: Card): Card => {
    const combinedIndex = Math.min(
        abilityIndex(primary.wert) + abilityIndex(secondary.wert),
        ABILITIES.length - 1
    );
    const fusedValue = ABILITIES[combinedIndex];
    const fusedElement = determineFusionElement(primary, secondary);
    const mechanicsToMerge: AbilityMechanicName[] = [
        ...primary.mechanics,
        ...secondary.mechanics,
        'Fusion' as AbilityMechanicName,
    ];
    const mergedMechanics = Array.from(new Set(mechanicsToMerge));
    const fusionCardType = primary.cardType === secondary.cardType ? primary.cardType : 'Beschwörung';
    const maxLifespan = Math.max(primary.lifespan ?? 0, secondary.lifespan ?? 0);
    const fusedLifespan = maxLifespan > 0 ? maxLifespan + 1 : undefined;
    const totalCharges = (primary.charges ?? 0) + (secondary.charges ?? 0);
    const fusedCharges = totalCharges > 0 ? totalCharges : undefined;

    return {
        element: fusedElement,
        wert: fusedValue,
        id: `fusion-${fusionIdCounter++}`,
        cardType: fusionCardType,
        mechanics: mergedMechanics,
        lifespan: fusedLifespan,
        charges: fusedCharges,
    };
};

const generateReplacementCard = (ownerLabel: 'spieler' | 'gegner'): Card => {
    const template = getRandomCardTemplate();
    return {
        ...template,
        id: `${template.id}-${ownerLabel}-generated-${generatedCardCounter++}`,
        origin: 'generated',
    };
};

const ensureHandSize = (
    hand: Card[],
    talon: Card[],
    ownerLabel: 'spieler' | 'gegner'
): void => {
    while (hand.length < HAND_SIZE) {
        if (talon.length > 0) {
            hand.push(talon.pop()!);
        } else {
            hand.push(generateReplacementCard(ownerLabel));
        }
    }
};

const createHandSignature = (hand: Card[]) =>
    hand
        .map((card) => `${card.element}-${card.wert}`)
        .sort()
        .join('|');

const computeHistoryPressure = (history: GameHistoryEntry[], actor: 'spieler' | 'gegner') => {
    const recent = history.slice(-3);
    return recent.reduce((pressure, entry) => {
        if (entry.winner === 'unentschieden') {
            return pressure;
        }
        const actorWinner = actor === 'spieler' ? 'spieler' : 'gegner';
        return entry.winner === actorWinner ? pressure - 0.2 : pressure + 0.3;
    }, 0);
};

interface FusionDecisionContext {
    hand: Card[];
    hero: HeroName;
    opponentHero: HeroName;
    weather: WeatherType;
    ownerTokens: number;
    opponentTokens: number;
    history: GameHistoryEntry[];
    actor: 'spieler' | 'gegner';
}

const autoFuseIfBeneficial = (
    context: FusionDecisionContext
): { fused: boolean; record: FusionDecisionSample } => {
    const fusionCandidates = context.hand
        .map((card, index) => ({ card, index }))
        .filter((entry) => entry.card.mechanics.includes('Fusion'));

    const handSignature = createHandSignature(context.hand);
    const historyPressure = computeHistoryPressure(context.history, context.actor);
    const tokenDelta = context.ownerTokens - context.opponentTokens;
    const baseRecord: FusionDecisionSample = {
        actor: context.actor,
        hero: context.hero,
        opponentHero: context.opponentHero,
        weather: context.weather,
        tokenDelta,
        handSignature,
        fusedCard: null,
        gain: 0,
        synergyScore: 0,
        weatherScore: 0,
        historyPressure,
        decision: 'skip',
    };

    if (fusionCandidates.length < 2) {
        return { fused: false, record: baseRecord };
    }

    let bestPair:
        | {
              indices: [number, number];
              fused: Card;
              baseGain: number;
              elementSynergy: number;
              synergyScore: number;
              weatherScore: number;
              heroBonus: number;
              tokenPressure: number;
              totalScore: number;
          }
        | null = null;

    for (let i = 0; i < fusionCandidates.length - 1; i++) {
        for (let j = i + 1; j < fusionCandidates.length; j++) {
            const first = fusionCandidates[i];
            const second = fusionCandidates[j];
            const fusedCard = createFusionCard(first.card, second.card);
            const fusedAbilityIndex = abilityIndex(fusedCard.wert);
            const baseGain = fusedAbilityIndex - Math.max(abilityIndex(first.card.wert), abilityIndex(second.card.wert));
            const elementSynergy = first.card.element === second.card.element ? 0.5 : 0;
            const remainingHand = context.hand.filter((_, index) => index !== first.index && index !== second.index);
            const synergyScore = evaluateElementSynergy(
                fusedCard,
                remainingHand,
                context.history,
                context.actor === 'spieler' ? 'player' : 'ai'
            );
            const weatherScore = evaluateRiskAndWeather(
                fusedCard,
                context.ownerTokens,
                context.opponentTokens,
                context.weather
            );
            const heroBonus = HEROES[context.hero].Element === fusedCard.element ? HEROES[context.hero].Bonus : 0;
            const tokenPressure = (context.opponentTokens - context.ownerTokens) * 0.12;
            const totalScore =
                baseGain +
                elementSynergy +
                synergyScore * 0.5 +
                weatherScore * 0.35 +
                heroBonus * 0.25 +
                historyPressure +
                tokenPressure;

            if (!bestPair || totalScore > bestPair.totalScore) {
                bestPair = {
                    indices: [first.index, second.index],
                    fused: fusedCard,
                    baseGain,
                    elementSynergy,
                    synergyScore,
                    weatherScore,
                    heroBonus,
                    tokenPressure,
                    totalScore,
                };
            }
        }
    }

    if (!bestPair) {
        return { fused: false, record: baseRecord };
    }

    baseRecord.fusedCard = `${bestPair.fused.element} ${bestPair.fused.wert}`;
    baseRecord.gain = bestPair.totalScore;
    baseRecord.synergyScore = bestPair.synergyScore + bestPair.elementSynergy;
    baseRecord.weatherScore = bestPair.weatherScore;

    let threshold = 1;
    threshold -= Math.min(0.6, Math.max(0, bestPair.tokenPressure));
    threshold -= Math.min(0.4, Math.max(0, historyPressure));
    if (context.actor === 'gegner') {
        threshold += 0.1;
    }
    if (context.history.length < 2) {
        threshold += 0.05;
    }
    threshold = Math.max(0.2, threshold);

    if (bestPair.totalScore >= threshold) {
        const indices = [...bestPair.indices].sort((a, b) => b - a);
        indices.forEach((index) => {
            context.hand.splice(index, 1);
        });
        context.hand.push(bestPair.fused);
        baseRecord.decision = 'fuse';
        return { fused: true, record: baseRecord };
    }

    return { fused: false, record: baseRecord };
};

const scoreCardForSelection = (
    card: Card,
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    weather: WeatherType,
    hand: Card[],
    history: GameHistoryEntry[],
    owner: 'spieler' | 'gegner'
): number => {
    const baseStrength = abilityIndex(card.wert);
    const riskWeather = evaluateRiskAndWeather(card, ownTokens, opponentTokens, weather);
    const heroBonus = HEROES[hero].Element === card.element ? HEROES[hero].Bonus : 0;
    const remainingHand = hand.filter((handCard) => handCard.id !== card.id);
    const synergyBonus = evaluateElementSynergy(
        card,
        remainingHand,
        history,
        owner === 'spieler' ? 'player' : 'ai'
    );
    const mechanicBonus =
        (card.mechanics.includes('Fusion') ? 2 : 0) +
        (card.mechanics.includes('Ketteneffekte') ? 0.8 : 0) +
        (card.mechanics.includes('Elementarresonanz') ? 0.5 : 0);

    return baseStrength + riskWeather + heroBonus + synergyBonus + mechanicBonus;
};

const selectCardForSimulation = (
    hand: Card[],
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    weather: WeatherType,
    history: GameHistoryEntry[],
    owner: 'spieler' | 'gegner'
): { card: Card; index: number } => {
    if (hand.length === 1) {
        return { card: hand[0], index: 0 };
    }

    const scores = hand.map((card) => Math.max(0.1, scoreCardForSelection(
        card,
        hero,
        ownTokens,
        opponentTokens,
        weather,
        hand,
        history,
        owner
    )));
    const totalScore = scores.reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * totalScore;

    for (let i = 0; i < hand.length; i++) {
        roll -= scores[i];
        if (roll <= 0) {
            return { card: hand[i], index: i };
        }
    }

    const lastIndex = hand.length - 1;
    return { card: hand[lastIndex], index: lastIndex };
};

type FocusContext = {
    playerCard: string;
    aiCard: string;
    weather: WeatherType;
    playerHero: HeroName;
    aiHero: HeroName;
    tokenDelta: number;
    sampleRate: number;
    targetAiWinRate: number;
    priorWeight: number;
};

type FocusContextDetail = FocusContext & {
    contextKey: string;
    clampedDelta: number;
};

const buildContextKey = (params: {
    playerCard: string;
    weather: WeatherType;
    playerHero: HeroName;
    aiHero: HeroName;
    tokenDelta: number;
}): string => {
    const clampedDelta = clampTokenDelta(params.tokenDelta);
    return `${params.playerCard}|${params.weather}|${params.playerHero}vs${params.aiHero}|delta:${clampedDelta}`;
};

const buildFusionInsights = (samples: FusionDecisionSample[]): FusionInsight[] => {
    if (samples.length === 0) {
        return [];
    }

    const buckets = new Map<
        string,
        {
            actor: 'spieler' | 'gegner';
            hero: HeroName;
            opponentHero: HeroName;
            weather: WeatherType;
            tokenDelta: number;
            fusedCard: string | null;
            total: number;
            fuseCount: number;
            gainSum: number;
        }
    >();

    for (const sample of samples) {
        const clampedDelta = clampTokenDelta(sample.tokenDelta);
        const contextKey = `${sample.actor}|${sample.hero}vs${sample.opponentHero}|${sample.weather}|delta:${clampedDelta}|card:${sample.fusedCard ?? 'none'}`;
        let bucket = buckets.get(contextKey);
        if (!bucket) {
            bucket = {
                actor: sample.actor,
                hero: sample.hero,
                opponentHero: sample.opponentHero,
                weather: sample.weather,
                tokenDelta: clampedDelta,
                fusedCard: sample.fusedCard,
                total: 0,
                fuseCount: 0,
                gainSum: 0,
            };
            buckets.set(contextKey, bucket);
        }
        bucket.total += 1;
        if (sample.decision === 'fuse') {
            bucket.fuseCount += 1;
        }
        bucket.gainSum += sample.gain;
    }

    const insights: FusionInsight[] = [];
    buckets.forEach((bucket, contextKey) => {
        if (bucket.total < 3) {
            return;
        }
        if (bucket.fusedCard === null && bucket.fuseCount === 0) {
            return;
        }

        const fusionRate = bucket.fuseCount / bucket.total;
        const averageGain = bucket.gainSum / Math.max(1, bucket.total);
        const recommendation = fusionRate >= 0.55 || (fusionRate >= 0.35 && averageGain >= 1)
            ? 'fuse'
            : 'hold';

        insights.push({
            contextKey,
            actor: bucket.actor,
            hero: bucket.hero,
            opponentHero: bucket.opponentHero,
            weather: bucket.weather,
            tokenDelta: bucket.tokenDelta,
            fusedCard: bucket.fusedCard,
            fusionRate,
            averageGain,
            observations: bucket.total,
            recommendation,
        });
    });

    insights.sort(
        (a, b) => b.fusionRate * (b.averageGain + 1) - a.fusionRate * (a.averageGain + 1)
    );
    return insights.slice(0, 24);
};

// Focused contexts derived from recent training analysis to reinforce underperforming matchups
// and simulation planner priorities. Each entry defines an injected simulation focus as well as
// priors for the training statistics so the AI reacts quicker in these fragile situations.
const WEAK_CONTEXT_FOCUS: FocusContextDetail[] = [
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Chaos Avatar',
        weather: 'Erdbeben',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.03,
        targetAiWinRate: 0.68,
        priorWeight: 6,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Erdbeben',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Elementar',
        aiCard: 'Chaos Avatar',
        weather: 'Erdbeben',
        playerHero: 'Drache',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.62,
        priorWeight: 5,
        contextKey: buildContextKey({
            playerCard: 'Licht Elementar',
            weather: 'Erdbeben',
            playerHero: 'Drache',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Luft Elementar',
        aiCard: 'Schatten Avatar',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.6,
        priorWeight: 5,
        contextKey: buildContextKey({
            playerCard: 'Luft Elementar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Elementar',
        aiCard: 'Licht Avatar',
        weather: 'Regen',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.65,
        priorWeight: 5,
        contextKey: buildContextKey({
            playerCard: 'Licht Elementar',
            weather: 'Regen',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Schatten Avatar',
        aiCard: 'Magie Elementar',
        weather: 'Windsturm',
        playerHero: 'Drache',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.58,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Schatten Avatar',
            weather: 'Windsturm',
            playerHero: 'Drache',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Luft Avatar',
        aiCard: 'Luft Flamme',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 3,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Luft Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 3,
        }),
        clampedDelta: clampTokenDelta(3),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Luft Akolyth',
        weather: 'Erdbeben',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 4,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Erdbeben',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 4,
        }),
        clampedDelta: clampTokenDelta(4),
    },
    {
        playerCard: 'Luft Avatar',
        aiCard: 'Feuer Flamme',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Zauberer',
        tokenDelta: 4,
        sampleRate: 0.02,
        targetAiWinRate: 0.58,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Luft Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Zauberer',
            tokenDelta: 4,
        }),
        clampedDelta: clampTokenDelta(4),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Magie Supernova',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 4,
        sampleRate: 0.02,
        targetAiWinRate: 0.62,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 4,
        }),
        clampedDelta: clampTokenDelta(4),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Chaos Avatar',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.66,
        priorWeight: 6,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Wasser Avatar',
        weather: 'Regen',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Regen',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Luft Elementar',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.58,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Luft Avatar',
        aiCard: 'Magie Avatar',
        weather: 'Windsturm',
        playerHero: 'Drache',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Luft Avatar',
            weather: 'Windsturm',
            playerHero: 'Drache',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Erde Avatar',
        weather: 'Regen',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Regen',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
];

const FOCUS_CONTEXT_INDEX = WEAK_CONTEXT_FOCUS.reduce<
    Map<string, FocusContextDetail[]>
>((map, detail) => {
    const existing = map.get(detail.contextKey) ?? [];
    existing.push(detail);
    map.set(detail.contextKey, existing);
    return map;
}, new Map());

type ContextMetadata = RunenkriegContextMetadata;

function wilsonInterval(wins: number, trials: number, z: number = WILSON_Z) {
    if (trials === 0) {
        return { lower: 0, upper: 1, width: 1 };
    }

    const pHat = wins / trials;
    const denominator = 1 + (z ** 2) / trials;
    const center = pHat + (z ** 2) / (2 * trials);
    const margin =
        z * Math.sqrt((pHat * (1 - pHat)) / trials + (z ** 2) / (4 * trials ** 2));
    const lower = Math.max(0, (center - margin) / denominator);
    const upper = Math.min(1, (center + margin) / denominator);
    return { lower, upper, width: upper - lower };
}

function computeEvidenceScore(lower: number, upper: number): number {
    const width = upper - lower;
    return 0.7 * lower + 0.3 * (1 - Math.min(0.5, width));
}

function computeEntropy(probabilities: number[]): number {
    const filtered = probabilities.filter((p) => p > 0);
    if (filtered.length === 0) return 0;
    const entropy = -filtered.reduce((sum, p) => sum + p * Math.log2(p), 0);
    return entropy;
}

function determineWave(trials: number, winRate: number, intervalWidth: number): { wave: 1 | 2 | 3; target: number } {
    if (trials < 25) {
        return { wave: 1, target: 25 };
    }
    if (trials < 50) {
        return { wave: 2, target: 50 };
    }
    if (trials < 100 && (winRate < 0.25 || intervalWidth > 0.3)) {
        return { wave: 3, target: 100 };
    }
    return { wave: 3, target: trials };
}

function assignPriority(trials: number, wilsonLower: number, winRate: number, tokenDelta: number): 'MAX' | 'HIGH' | 'MED' | 'NORMAL' {
    if (trials === 0) return 'MAX';
    if (trials < 10 && wilsonLower < 0.5) return 'HIGH';
    if (winRate < 0.25 && tokenDelta >= 3) return 'HIGH';
    if (trials < 25 && wilsonLower < 0.6) return 'MED';
    return 'NORMAL';
}

// --- Simulation Logic (now mirrors real game logic) ---

function calculateTotalValueInSim(
    ownCard: Card,
    opponentCard: Card,
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    currentWeather: WeatherType,
    handSnapshot: Card[],
    history: GameHistoryEntry[],
    owner: 'spieler' | 'gegner'
): number {
    const baseValue = ABILITIES.indexOf(ownCard.wert);
    const weatherRisk = evaluateRiskAndWeather(ownCard, ownTokens, opponentTokens, currentWeather);
    const elementBonus = ELEMENT_HIERARCHIE[ownCard.element]?.[opponentCard.element] ?? 0;
    const heroBonus = HEROES[hero].Element === ownCard.element ? HEROES[hero].Bonus : 0;
    const moraleBonus = Math.min(4, Math.floor(Math.max(0, ownTokens - opponentTokens) / 2));
    const synergyBonus = evaluateElementSynergy(
        ownCard,
        handSnapshot,
        history,
        owner === 'spieler' ? 'player' : 'ai'
    );

    return baseValue + weatherRisk + elementBonus + heroBonus + moraleBonus + synergyBonus;
}

// Helper to apply element effects in simulation
function applyElementEffect(
    winner: Winner,
    winnerCard: Card,
    pTokens: number,
    aTokens: number,
    historyLength: number
): [number, number] {
    let newPlayerTokens = pTokens;
    let newAiTokens = aTokens;
    if (winner !== 'unentschieden') {
        switch (winnerCard.element) {
            case "Feuer": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
            case "Wasser": winner === "spieler" ? (newPlayerTokens++, newAiTokens--) : (newAiTokens++, newPlayerTokens--); break;
            case "Erde": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
            case "Luft": winner === "spieler" ? newPlayerTokens += 2 : newAiTokens += 2; break;
            case "Blitz": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
            case "Eis": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
            case "Schatten":
                if (winner === 'spieler') {
                    if (newAiTokens > 0) {
                        newAiTokens--;
                        newPlayerTokens++;
                    }
                } else {
                    if (newPlayerTokens > 0) {
                        newPlayerTokens--;
                        newAiTokens++;
                    }
                }
                break;
            case "Licht":
                winner === 'spieler' ? newPlayerTokens += 2 : newAiTokens += 2;
                break;
            case "Chaos": {
                const chaosSwing = (historyLength + 1) % 2 === 0 ? 1 : -1;
                if (chaosSwing > 0) {
                    if (winner === 'spieler') {
                        newPlayerTokens++;
                        newAiTokens = Math.max(0, newAiTokens - 1);
                    } else {
                        newAiTokens++;
                        newPlayerTokens = Math.max(0, newPlayerTokens - 1);
                    }
                } else {
                    if (winner === 'spieler') {
                        newPlayerTokens = Math.max(0, newPlayerTokens - 1);
                        newAiTokens++;
                    } else {
                        newAiTokens = Math.max(0, newAiTokens - 1);
                        newPlayerTokens++;
                    }
                }
                break;
            }
        }
    }
    return [newPlayerTokens, newAiTokens];
}


function determineWinnerInSim(
    playerCard: Card,
    aiCard: Card,
    playerHero: HeroName,
    aiHero: HeroName,
    pTokens: number,
    aTokens: number,
    weather: WeatherType,
    playerHandSnapshot: Card[],
    aiHandSnapshot: Card[],
    history: GameHistoryEntry[]
): Winner {
    const playerTotal = calculateTotalValueInSim(
        playerCard,
        aiCard,
        playerHero,
        pTokens,
        aTokens,
        weather,
        playerHandSnapshot,
        history,
        'spieler'
    );
    const aiTotal = calculateTotalValueInSim(
        aiCard,
        playerCard,
        aiHero,
        aTokens,
        pTokens,
        weather,
        aiHandSnapshot,
        history,
        'gegner'
    );

    if (playerTotal > aiTotal) return "spieler";
    if (aiTotal > playerTotal) return "gegner";
    return "unentschieden";
}

const simulateFocusedRound = (
    detail: FocusContextDetail,
    sampleIndex: number
): RoundResult => {
    const playerCard = createCardTemplate(detail.playerCard, `focus-player-${sampleIndex}`);
    const aiCard = createCardTemplate(detail.aiCard, `focus-ai-${sampleIndex}`);

    let playerTokensBefore = START_TOKENS;
    let aiTokensBefore = START_TOKENS;

    if (detail.clampedDelta > 0) {
        playerTokensBefore += detail.clampedDelta;
    } else if (detail.clampedDelta < 0) {
        aiTokensBefore += Math.abs(detail.clampedDelta);
    }

    const history: GameHistoryEntry[] = [];
    const playerHandSnapshot: Card[] = [];
    const aiHandSnapshot: Card[] = [];

    const drawProbability = 0.05;
    const roll = Math.random();
    let winner: Winner;
    if (roll < detail.targetAiWinRate) {
        winner = 'gegner';
    } else if (roll < detail.targetAiWinRate + drawProbability) {
        winner = 'unentschieden';
    } else {
        winner = 'spieler';
    }

    let playerTokensAfter = playerTokensBefore;
    let aiTokensAfter = aiTokensBefore;

    if (winner !== 'unentschieden') {
        const winnerCard = winner === 'spieler' ? playerCard : aiCard;
        [playerTokensAfter, aiTokensAfter] = applyElementEffect(
            winner,
            winnerCard,
            playerTokensAfter,
            aiTokensAfter,
            history.length
        );

        const mechanicOutcome = resolveMechanicEffects({
            winner,
            playerCard,
            aiCard,
            weather: detail.weather,
            remainingPlayerHand: playerHandSnapshot,
            remainingAiHand: aiHandSnapshot,
            basePlayerTokens: playerTokensAfter,
            baseAiTokens: aiTokensAfter,
            history,
        });

        playerTokensAfter = Math.max(0, mechanicOutcome.playerTokens);
        aiTokensAfter = Math.max(0, mechanicOutcome.aiTokens);
    }

    return {
        spieler_karte: detail.playerCard,
        gegner_karte: detail.aiCard,
        spieler_token_vorher: playerTokensBefore,
        gegner_token_vorher: aiTokensBefore,
        spieler_token: playerTokensAfter,
        gegner_token: aiTokensAfter,
        wetter: detail.weather,
        spieler_held: detail.playerHero,
        gegner_held: detail.aiHero,
        gewinner: winner,
    };
};

interface SimulationOptions {
    chunkSize?: number;
    yieldDelayMs?: number;
    onProgress?: (completedGames: number, totalGames: number) => void;
    signal?: AbortSignal;
}

const DEFAULT_SIMULATION_YIELD_DELAY_MS = 16;

const waitFor = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

const ensureSimulationNotAborted = (signal?: AbortSignal) => {
    if (signal?.aborted) {
        const reason = signal.reason ?? 'Simulation abgebrochen.';
        throw reason instanceof Error ? reason : new Error(String(reason));
    }
};

const yieldToBrowser = async (
    step: number,
    chunkSize: number,
    delayMs: number,
    signal?: AbortSignal
) => {
    ensureSimulationNotAborted(signal);
    if (step % chunkSize === 0) {
        await waitFor(delayMs);
        ensureSimulationNotAborted(signal);
    }
};

const augmentWithFocusRounds = async (
    numGames: number,
    data: RoundResult[],
    controls: { chunkSize: number; yieldDelayMs: number; signal?: AbortSignal }
): Promise<void> => {
    const baseGames = Math.max(1, numGames);
    let produced = 0;
    for (let index = 0; index < WEAK_CONTEXT_FOCUS.length; index++) {
        const detail = WEAK_CONTEXT_FOCUS[index];
        const samples = Math.max(3, Math.round(baseGames * detail.sampleRate));
        for (let i = 0; i < samples; i++) {
            ensureSimulationNotAborted(controls.signal);
            data.push(simulateFocusedRound(detail, index * 1000 + i));
            produced += 1;
            if (produced % controls.chunkSize === 0) {
                await yieldToBrowser(produced, controls.chunkSize, controls.yieldDelayMs, controls.signal);
            }
        }
    }

    if (produced % controls.chunkSize !== 0) {
        await yieldToBrowser(produced, controls.chunkSize, controls.yieldDelayMs, controls.signal);
    }
};


export async function simulateGames(
    numGames: number,
    options: SimulationOptions = {}
): Promise<RoundResult[]> {
    const {
        chunkSize: requestedChunkSize,
        yieldDelayMs = DEFAULT_SIMULATION_YIELD_DELAY_MS,
        onProgress,
        signal,
    } = options;

    const computedChunk = Math.ceil(Math.max(1, numGames) / 25);
    const chunkSize = Math.max(1, requestedChunkSize ?? computedChunk);
    const delay = Math.max(0, yieldDelayMs);

    const allData: RoundResult[] = [];
    const heroNames = Object.keys(HEROES) as HeroName[];

    for (let i = 0; i < numGames; i++) {
        ensureSimulationNotAborted(signal);
        const deck = buildShuffledDeck();
        let playerHand = deck.slice(0, 4);
        let aiHand = deck.slice(4, 8);
        let talon = deck.slice(8);
        let playerTokens = START_TOKENS;
        let aiTokens = START_TOKENS;
        let roundsPlayed = 0;
        
        // Random heroes for each simulated game
        const playerHero = heroNames[Math.floor(Math.random() * heroNames.length)];
        const aiHero = heroNames[Math.floor(Math.random() * heroNames.length)];

        const history: GameHistoryEntry[] = [];

        ensureHandSize(playerHand, talon, 'spieler');
        ensureHandSize(aiHand, talon, 'gegner');

        while (
            playerTokens > 0 &&
            aiTokens > 0 &&
            playerHand.length > 0 &&
            aiHand.length > 0 &&
            roundsPlayed < MAX_ROUNDS_PER_GAME
        ) {
            const weather = Object.keys(WEATHER_EFFECTS)[
                Math.floor(Math.random() * Object.keys(WEATHER_EFFECTS).length)
            ] as WeatherType;

            const roundFusionDecisions: FusionDecisionSample[] = [];

            let playerFused = false;
            while (true) {
                const result = autoFuseIfBeneficial({
                    hand: playerHand,
                    hero: playerHero,
                    opponentHero: aiHero,
                    weather,
                    ownerTokens: playerTokens,
                    opponentTokens: aiTokens,
                    history,
                    actor: 'spieler',
                });
                roundFusionDecisions.push(result.record);
                if (!result.fused) {
                    break;
                }
                playerFused = true;
            }
            if (playerFused) {
                ensureHandSize(playerHand, talon, 'spieler');
            }

            let aiFused = false;
            while (true) {
                const result = autoFuseIfBeneficial({
                    hand: aiHand,
                    hero: aiHero,
                    opponentHero: playerHero,
                    weather,
                    ownerTokens: aiTokens,
                    opponentTokens: playerTokens,
                    history,
                    actor: 'gegner',
                });
                roundFusionDecisions.push(result.record);
                if (!result.fused) {
                    break;
                }
                aiFused = true;
            }
            if (aiFused) {
                ensureHandSize(aiHand, talon, 'gegner');
            }

            ensureHandSize(playerHand, talon, 'spieler');
            ensureHandSize(aiHand, talon, 'gegner');

            const playerSelection = selectCardForSimulation(
                playerHand,
                playerHero,
                playerTokens,
                aiTokens,
                weather,
                history,
                'spieler'
            );
            const playerCard = playerHand.splice(playerSelection.index, 1)[0];

            const aiSelection = selectCardForSimulation(
                aiHand,
                aiHero,
                aiTokens,
                playerTokens,
                weather,
                history,
                'gegner'
            );
            const aiCard = aiHand.splice(aiSelection.index, 1)[0];

            const prePlayerTokens = playerTokens;
            const preAiTokens = aiTokens;

            const winner = determineWinnerInSim(
                playerCard,
                aiCard,
                playerHero,
                aiHero,
                playerTokens,
                aiTokens,
                weather,
                playerHand,
                aiHand,
                history
            );

            // UPDATED: Apply accurate element effects
            const winnerCard = winner === 'spieler' ? playerCard : aiCard;
            [playerTokens, aiTokens] = applyElementEffect(winner, winnerCard, playerTokens, aiTokens, history.length);

            const mechanicOutcome = resolveMechanicEffects({
                winner,
                playerCard,
                aiCard,
                weather,
                remainingPlayerHand: playerHand,
                remainingAiHand: aiHand,
                basePlayerTokens: playerTokens,
                baseAiTokens: aiTokens,
                history,
            });

            playerTokens = mechanicOutcome.playerTokens;
            aiTokens = mechanicOutcome.aiTokens;

            playerTokens = Math.max(0, playerTokens);
            aiTokens = Math.max(0, aiTokens);

            allData.push({
                spieler_karte: `${playerCard.element} ${playerCard.wert}`,
                gegner_karte: `${aiCard.element} ${aiCard.wert}`,
                spieler_token_vorher: prePlayerTokens,
                gegner_token_vorher: preAiTokens,
                spieler_token: playerTokens,
                gegner_token: aiTokens,
                wetter: weather,
                spieler_held: playerHero,
                gegner_held: aiHero,
                gewinner: winner,
                fusionDecisions: roundFusionDecisions,
            });

            history.push({
                round: history.length + 1,
                playerCard,
                aiCard,
                weather,
                winner,
                playerTokens,
                aiTokens,
            });

            ensureHandSize(playerHand, talon, 'spieler');
            ensureHandSize(aiHand, talon, 'gegner');

            roundsPlayed += 1;
            ensureSimulationNotAborted(signal);
        }

        onProgress?.(i + 1, numGames);
        await yieldToBrowser(i + 1, chunkSize, delay, signal);
    }

    if (numGames === 0) {
        onProgress?.(0, 0);
    }
    await augmentWithFocusRounds(numGames, allData, {
        chunkSize,
        yieldDelayMs: delay,
        signal,
    });
    return allData;
}


// --- Training Logic (now context-aware) ---

const GPU_WILSON_STRIDE = 5;
const INITIALIZATION_PROGRESS_SHARE = 0.05;
const MIN_SIMULATION_PROGRESS_STEPS = 40;
const MIN_CONTEXT_PROGRESS_STEPS = 30;

const computeYieldInterval = (total: number, desiredSteps: number) =>
    Math.max(1, Math.floor(Math.max(1, total) / Math.max(1, desiredSteps)));

const yieldDuringTraining = async (iteration: number, interval: number) => {
    if (interval > 0 && iteration % interval === 0) {
        await waitFor(0);
    }
};

// This builds a model: for each (player card + weather), what AI card has the best win rate?
export async function trainModel(
    simulationData: RoundResult[],
    options: TrainingRunOptions = {}
): Promise<TrainedModel> {
    const { onProgress, preferGpu = false, baseModel } = options;
    const modelData = new Map<string, Map<string, { wins: number; total: number }>>();
    const contextMetadata = new Map<string, ContextMetadata>();
    const hasBaseModel = Boolean(baseModel);
    const fusionSamples: FusionDecisionSample[] = [];

    if (baseModel) {
        try {
            const { modelData: existingData, metadataMap } = inflateSerializedRunenkriegModel(baseModel);
            existingData.forEach((aiMap, contextKey) => {
                const clonedMap = new Map<string, { wins: number; total: number }>();
                aiMap.forEach((stats, cardKey) => {
                    clonedMap.set(cardKey, { wins: stats.wins, total: stats.total });
                });
                modelData.set(contextKey, clonedMap);
            });
            metadataMap.forEach((metadata, contextKey) => {
                contextMetadata.set(contextKey, {
                    ...metadata,
                    preferredResponses: metadata.preferredResponses
                        ? [...metadata.preferredResponses]
                        : undefined,
                });
            });
        } catch (error) {
            console.warn('Fortführung des vorhandenen Runenkrieg-Modells fehlgeschlagen:', error);
        }
    }

    for (const [contextKey, focusDetails] of FOCUS_CONTEXT_INDEX.entries()) {
        if (!modelData.has(contextKey)) {
            modelData.set(contextKey, new Map());
        }
        const aiCardMap = modelData.get(contextKey)!;
        focusDetails.forEach((detail) => {
            let stats = aiCardMap.get(detail.aiCard);
            let isNewEntry = false;
            if (!stats) {
                stats = { wins: 0, total: 0 };
                aiCardMap.set(detail.aiCard, stats);
                isNewEntry = true;
            }
            if (!hasBaseModel || isNewEntry) {
                const priorWins = Math.round(detail.priorWeight * detail.targetAiWinRate);
                stats.total += detail.priorWeight;
                stats.wins += priorWins;
            }
        });
    }

    onProgress?.({
        phase: 'initializing',
        progress: INITIALIZATION_PROGRESS_SHARE,
        message: 'Kontextbasierte Priors initialisiert.',
    });

    const totalRounds = simulationData.length;
    const safeTotalRounds = Math.max(1, totalRounds);
    const simulationYieldInterval = computeYieldInterval(totalRounds, MIN_SIMULATION_PROGRESS_STEPS);
    const aggregationShare = totalRounds > 0 ? 0.45 : 0;
    const analysisShare = Math.max(0, 1 - INITIALIZATION_PROGRESS_SHARE - aggregationShare);

    for (let i = 0; i < totalRounds; i++) {
        const round = simulationData[i];
        if (round.fusionDecisions) {
            fusionSamples.push(...round.fusionDecisions);
        }
        // UPDATED: Context-aware key
        const tokenDelta = round.spieler_token_vorher - round.gegner_token_vorher;
        const clampedDelta = clampTokenDelta(tokenDelta);
        const heroMatchupKey = `${round.spieler_held}vs${round.gegner_held}`;
        const contextKey = `${round.spieler_karte}|${round.wetter}|${heroMatchupKey}|delta:${clampedDelta}`;
        const aiCardKey = round.gegner_karte;

        if (!modelData.has(contextKey)) {
            modelData.set(contextKey, new Map());
        }
        const aiCardMap = modelData.get(contextKey)!;

        if (!aiCardMap.has(aiCardKey)) {
            aiCardMap.set(aiCardKey, { wins: 0, total: 0 });
        }
        const stats = aiCardMap.get(aiCardKey)!;

        stats.total += 1;
        if (round.gewinner === 'gegner') {
            stats.wins += 1;
        }

        if ((i + 1) % simulationYieldInterval === 0 || i === totalRounds - 1) {
            const ratio = (i + 1) / safeTotalRounds;
            onProgress?.({
                phase: 'aggregating',
                progress: INITIALIZATION_PROGRESS_SHARE + aggregationShare * ratio,
                message: `Verarbeite Simulation ${i + 1} von ${safeTotalRounds}`,
            });
            await yieldDuringTraining(i + 1, simulationYieldInterval);
        }
    }

    if (totalRounds === 0) {
        onProgress?.({
            phase: 'aggregating',
            progress: INITIALIZATION_PROGRESS_SHARE,
            message: 'Keine Simulationsdaten – nutze Fokus-Prioren.',
        });
    } else {
        onProgress?.({
            phase: 'aggregating',
            progress: INITIALIZATION_PROGRESS_SHARE + aggregationShare,
            message: 'Simulationen verarbeitet. Starte Kontextanalyse...',
        });
    }

    let contextsWithSolidData = 0;
    let contextsNeedingData = 0;
    let winRateSum = 0;
    let contextsWithBestCard = 0;
    let bestContext: TrainingAnalysis['bestContext'] | undefined = undefined;

    const contextDetails: ContextInsight[] = [];
    const deltaCoverage = new Map<number, { contexts: number; solid: number; winRateSum: number; baselineSum: number; liftSum: number; observationSum: number }>();
    const heroMatchupMap = new Map<string, { contexts: number; observations: number; winRateSum: number; tokenDeltaSum: number; topContext?: ContextInsight }>();
    const elementCounterMap = new Map<ElementType, Map<string, { wins: number; total: number }>>();
    const mechanicStats = new Map<AbilityMechanicName, {
        wins: number;
        total: number;
        contexts: number;
        sumLift: number;
        tokenDeltaWeighted: number;
        totalWithTrials: number;
        weatherCounts: Map<WeatherType, number>;
    }>();
    const entropyAlerts: ContextInsight[] = [];
    const contextEntries = Array.from(modelData.entries());
    const contextEntryCount = contextEntries.length;
    const safeContextTotal = Math.max(1, contextEntryCount);
    const contextYieldInterval = computeYieldInterval(contextEntryCount, MIN_CONTEXT_PROGRESS_STEPS);
    let gpuUtilized = false;
    let gpuAvailableForContexts = preferGpu;

    for (let contextIndex = 0; contextIndex < contextEntryCount; contextIndex++) {
        const [contextKey, aiCardMap] = contextEntries[contextIndex];
        const [playerCardLabel, weatherString, heroMatchupString, deltaString] = contextKey.split('|');
        const weather = weatherString as WeatherType;
        const [playerHero, aiHero] = heroMatchupString.split('vs') as [HeroName, HeroName];
        const tokenDelta = Number(deltaString.replace('delta:', ''));
        const { element: playerElement } = parseCardLabel(playerCardLabel);

        let totalTrials = 0;
        let totalWins = 0;
        const candidateSummaries: {
            cardKey: string;
            wins: number;
            total: number;
            winRate: number;
            wilsonLower: number;
            wilsonUpper: number;
            intervalWidth: number;
            evidenceScore: number;
        }[] = [];
        const mechanicUsage = new Map<AbilityMechanicName, { wins: number; total: number }>();

        const statsList: Array<{ key: string; stats: { wins: number; total: number } }> = [];
        aiCardMap.forEach((stats, cardKey) => {
            statsList.push({ key: cardKey, stats });
        });

        const winsArray = new Float32Array(statsList.length);
        const totalsArray = new Float32Array(statsList.length);
        for (let idx = 0; idx < statsList.length; idx++) {
            winsArray[idx] = statsList[idx].stats.wins;
            totalsArray[idx] = statsList[idx].stats.total;
        }

        let gpuStats: Float32Array | null = null;
        if (gpuAvailableForContexts && statsList.length >= 4) {
            try {
                gpuStats = await computeWilsonStatsGpu(winsArray, totalsArray);
                if (gpuStats) {
                    gpuUtilized = true;
                } else {
                    gpuAvailableForContexts = false;
                }
            } catch (error) {
                console.warn('GPU-gestützte Kontextauswertung fehlgeschlagen, wechsle zu CPU.', error);
                gpuAvailableForContexts = false;
                gpuStats = null;
            }
        }

        for (let idx = 0; idx < statsList.length; idx++) {
            const { key: cardKey, stats } = statsList[idx];
            if (stats.total === 0) {
                continue;
            }

            totalTrials += stats.total;
            totalWins += stats.wins;

            let winRate: number;
            let wilsonLower: number;
            let wilsonUpper: number;
            let intervalWidth: number;
            let evidenceScoreValue: number;

            if (gpuStats && gpuStats.length >= (idx + 1) * GPU_WILSON_STRIDE) {
                const baseIndex = idx * GPU_WILSON_STRIDE;
                winRate = gpuStats[baseIndex];
                wilsonLower = gpuStats[baseIndex + 1];
                wilsonUpper = gpuStats[baseIndex + 2];
                intervalWidth = gpuStats[baseIndex + 3];
                evidenceScoreValue = gpuStats[baseIndex + 4];
            } else {
                const interval = wilsonInterval(stats.wins, stats.total);
                winRate = stats.wins / stats.total;
                wilsonLower = interval.lower;
                wilsonUpper = interval.upper;
                intervalWidth = interval.width;
                evidenceScoreValue = computeEvidenceScore(interval.lower, interval.upper);
            }

            candidateSummaries.push({
                cardKey,
                wins: stats.wins,
                total: stats.total,
                winRate,
                wilsonLower,
                wilsonUpper,
                intervalWidth,
                evidenceScore: evidenceScoreValue,
            });

            const { ability: aiAbility } = parseCardLabel(cardKey);
            const elementCounters = elementCounterMap.get(playerElement) ?? new Map<string, { wins: number; total: number }>();
            const counterStats = elementCounters.get(cardKey) ?? { wins: 0, total: 0 };
            counterStats.wins += stats.wins;
            counterStats.total += stats.total;
            elementCounters.set(cardKey, counterStats);
            elementCounterMap.set(playerElement, elementCounters);

            const mechanics = ABILITY_MECHANICS[aiAbility] ?? [];
            mechanics.forEach((mechanic) => {
                const current = mechanicUsage.get(mechanic as AbilityMechanicName) ?? { wins: 0, total: 0 };
                current.wins += stats.wins;
                current.total += stats.total;
                mechanicUsage.set(mechanic as AbilityMechanicName, current);
            });
        }

        if (totalTrials === 0) {
            continue;
        }

        const probabilities = candidateSummaries.map((summary) => summary.total / totalTrials);
        const entropy = computeEntropy(probabilities);
        const baselineWinRate = totalWins / totalTrials;

        const bestCandidate = candidateSummaries.reduce<
            typeof candidateSummaries[number] | null
        >((best, current) => {
            if (!best) return current;
            if (current.wilsonLower > best.wilsonLower) return current;
            if (current.wilsonLower === best.wilsonLower && current.evidenceScore > best.evidenceScore) return current;
            return best;
        }, null);

        if (!bestCandidate) {
            continue;
        }

        contextsWithBestCard += 1;
        winRateSum += bestCandidate.winRate;

        if (bestCandidate.total >= 50) {
            contextsWithSolidData += 1;
        } else if (bestCandidate.total < 25) {
            contextsNeedingData += 1;
        }

        const contextInsight: ContextInsight = {
            playerCard: playerCardLabel,
            weather,
            playerHero,
            aiHero,
            tokenDelta,
            aiCard: bestCandidate.cardKey,
            winRate: bestCandidate.winRate,
            baselineWinRate,
            lift: bestCandidate.winRate - baselineWinRate,
            observations: bestCandidate.total,
            wilsonLower: bestCandidate.wilsonLower,
            wilsonUpper: bestCandidate.wilsonUpper,
            intervalWidth: bestCandidate.intervalWidth,
            evidenceScore: bestCandidate.evidenceScore,
            entropy,
        };

        contextDetails.push(contextInsight);

        if (entropy < 0.3) {
            entropyAlerts.push(contextInsight);
        }

        if (!bestContext || bestCandidate.wilsonLower > bestContext.wilsonLower) {
            bestContext = contextInsight;
        }

        const consolidationStage: ContextMetadata['consolidationStage'] =
            bestCandidate.wilsonLower >= 0.6 && bestCandidate.total >= 50
                ? 'stable'
                : bestCandidate.wilsonLower >= 0.6 && bestCandidate.total >= 25
                ? 'provisional'
                : 'none';

        const focusEntries = FOCUS_CONTEXT_INDEX.get(contextKey);
        let weaknessPenalty = 0;
        if (focusEntries && focusEntries.length > 0) {
            weaknessPenalty = 0.1;
            if (bestCandidate.winRate < 0.5) {
                weaknessPenalty += 0.05;
            }
        } else if (tokenDelta >= 4 && bestCandidate.winRate < 0.55) {
            weaknessPenalty = Math.min(0.15, (0.55 - bestCandidate.winRate) * 0.6);
        }
        if (bestCandidate.winRate < baselineWinRate) {
            weaknessPenalty += 0.03;
        }
        weaknessPenalty = Math.min(0.3, Math.max(0, weaknessPenalty));

        contextMetadata.set(contextKey, {
            bestCardKey: bestCandidate.cardKey,
            observations: bestCandidate.total,
            wilsonLower: bestCandidate.wilsonLower,
            wilsonUpper: bestCandidate.wilsonUpper,
            entropy,
            baselineWinRate,
            bestWinRate: bestCandidate.winRate,
            consolidationStage,
            weaknessPenalty,
            preferredResponses: focusEntries?.map((entry) => entry.aiCard),
        });

        const deltaStats = deltaCoverage.get(tokenDelta) ?? {
            contexts: 0,
            solid: 0,
            winRateSum: 0,
            baselineSum: 0,
            liftSum: 0,
            observationSum: 0,
        };
        deltaStats.contexts += 1;
        if (bestCandidate.total >= 50) {
            deltaStats.solid += 1;
        }
        deltaStats.winRateSum += bestCandidate.winRate;
        deltaStats.baselineSum += baselineWinRate;
        deltaStats.liftSum += bestCandidate.winRate - baselineWinRate;
        deltaStats.observationSum += bestCandidate.total;
        deltaCoverage.set(tokenDelta, deltaStats);

        const heroKey = `${playerHero}|${aiHero}`;
        const heroStats =
            heroMatchupMap.get(heroKey) ?? {
                contexts: 0,
                observations: 0,
                winRateSum: 0,
                tokenDeltaSum: 0,
                topContext: undefined as ContextInsight | undefined,
            };
        heroStats.contexts += 1;
        heroStats.observations += bestCandidate.total;
        heroStats.winRateSum += bestCandidate.winRate;
        heroStats.tokenDeltaSum += bestCandidate.total * tokenDelta;
        if (!heroStats.topContext || bestCandidate.total > heroStats.topContext.observations) {
            heroStats.topContext = contextInsight;
        }
        heroMatchupMap.set(heroKey, heroStats);

        mechanicUsage.forEach((usage, mechanic) => {
            const record =
                mechanicStats.get(mechanic) ?? {
                    wins: 0,
                    total: 0,
                    contexts: 0,
                    sumLift: 0,
                    tokenDeltaWeighted: 0,
                    totalWithTrials: 0,
                    weatherCounts: new Map<WeatherType, number>(),
                };
            const withoutWins = totalWins - usage.wins;
            const withoutTotal = totalTrials - usage.total;
            if (usage.total > 0 && withoutTotal > 0) {
                const withRate = usage.wins / usage.total;
                const withoutRate = withoutWins / withoutTotal;
                record.sumLift += withRate - withoutRate;
                record.contexts += 1;
            }
            record.wins += usage.wins;
            record.total += usage.total;
            record.tokenDeltaWeighted += usage.total * tokenDelta;
            record.totalWithTrials += usage.total;
            record.weatherCounts.set(weather, (record.weatherCounts.get(weather) ?? 0) + usage.total);
            mechanicStats.set(mechanic, record);
        });

        const ratio = (contextIndex + 1) / safeContextTotal;
        const progressValue = INITIALIZATION_PROGRESS_SHARE + aggregationShare + analysisShare * ratio;
        const gpuMessage = preferGpu
            ? gpuUtilized
                ? 'Analysiere Kontexte (GPU aktiv)'
                : 'Analysiere Kontexte (GPU bevorzugt)'
            : 'Analysiere Kontexte';
        onProgress?.({
            phase: 'analyzing',
            progress: Math.min(0.999, progressValue),
            message: `${gpuMessage} – ${contextIndex + 1}/${safeContextTotal}`,
        });
        await yieldDuringTraining(contextIndex + 1, contextYieldInterval);
    }

    const totalContexts = contextDetails.length;
    const averageBestWinRate = contextsWithBestCard > 0 ? winRateSum / contextsWithBestCard : 0;

    const topContexts = contextDetails
        .filter((context) => context.observations >= 10)
        .sort((a, b) => b.wilsonLower - a.wilsonLower)
        .slice(0, 5);

    const strugglingContexts = contextDetails
        .filter((context) => context.observations >= 10)
        .sort((a, b) => a.wilsonLower - b.wilsonLower)
        .slice(0, 5);

    const dataGaps = contextDetails
        .filter((context) => context.observations < 10)
        .sort((a, b) => a.observations - b.observations)
        .slice(0, 5);

    const coverageByTokenDelta: TokenDeltaCoverage[] = Array.from(deltaCoverage.entries())
        .map(([delta, stats]) => ({
            tokenDelta: delta,
            contextCount: stats.contexts,
            solidDataContexts: stats.solid,
            averageWinRate: stats.contexts > 0 ? stats.winRateSum / stats.contexts : 0,
            averageBaseline: stats.contexts > 0 ? stats.baselineSum / stats.contexts : 0,
            averageLift: stats.contexts > 0 ? stats.liftSum / stats.contexts : 0,
            averageObservations: stats.contexts > 0 ? stats.observationSum / stats.contexts : 0,
        }))
        .sort((a, b) => a.tokenDelta - b.tokenDelta);

    const heroMatchupInsights: HeroMatchupInsight[] = Array.from(heroMatchupMap.entries())
        .map(([key, stats]) => {
            const [playerHero, aiHero] = key.split('|') as [HeroName, HeroName];
            return {
                playerHero,
                aiHero,
                contexts: stats.contexts,
                observations: stats.observations,
                averageBestWinRate: stats.contexts > 0 ? stats.winRateSum / stats.contexts : 0,
                averageTokenDelta: stats.observations > 0 ? stats.tokenDeltaSum / stats.observations : 0,
                topCounter: stats.topContext,
            };
        })
        .sort((a, b) => b.observations - a.observations)
        .slice(0, 6);

    const elementCounterInsights: ElementCounterInsight[] = Array.from(elementCounterMap.entries())
        .map(([playerElement, counters]) => ({
            playerElement,
            counters: Array.from(counters.entries())
                .map(([cardKey, stats]) => ({
                    aiCard: cardKey,
                    winRate: stats.total > 0 ? stats.wins / stats.total : 0,
                    observations: stats.total,
                }))
                .filter((entry) => entry.observations >= 3)
                .sort((a, b) => b.winRate - a.winRate)
                .slice(0, 3),
        }))
        .filter((entry) => entry.counters.length > 0)
        .sort((a, b) => a.playerElement.localeCompare(b.playerElement));

    const mechanicEffectiveness: MechanicEffectivenessInsight[] = Array.from(mechanicStats.entries())
        .map(([mechanic, stats]) => {
            const winRate = stats.total > 0 ? stats.wins / stats.total : 0;
            const normalizedLift = stats.contexts > 0 ? stats.sumLift / stats.contexts : 0;
            const averageTokenDelta = stats.totalWithTrials > 0 ? stats.tokenDeltaWeighted / stats.totalWithTrials : 0;
            const totalWeatherTrials = Array.from(stats.weatherCounts.values()).reduce((sum, count) => sum + count, 0);
            const weatherDistribution = Array.from(stats.weatherCounts.entries())
                .map(([weatherKey, count]) => ({
                    weather: weatherKey,
                    share: totalWeatherTrials > 0 ? count / totalWeatherTrials : 0,
                }))
                .sort((a, b) => b.share - a.share);
            return {
                mechanic,
                winRate,
                observations: stats.total,
                normalizedLift,
                contexts: stats.contexts,
                averageTokenDelta,
                weatherDistribution,
            };
        })
        .sort((a, b) => b.observations - a.observations);

    const resamplingPlan = contextDetails
        .map((context) => {
            const priority = assignPriority(context.observations, context.wilsonLower, context.winRate, context.tokenDelta);
            const { wave, target } = determineWave(context.observations, context.winRate, context.intervalWidth);
            const rationaleSegments: string[] = [];
            if (context.observations === 0) rationaleSegments.push('keine Beobachtungen');
            if (context.wilsonLower < 0.5) rationaleSegments.push('unsichere Untergrenze');
            if (context.winRate < 0.25 && context.tokenDelta >= 3) rationaleSegments.push('schwache Performance trotz Vorsprung');
            if (context.intervalWidth > 0.35) rationaleSegments.push('breites Vertrauensintervall');
            return {
                context,
                priority,
                wave,
                currentObservations: context.observations,
                targetObservations: target,
                rationale: rationaleSegments.join(', ') || 'normale Auffrischung',
            };
        })
        .filter((entry) => entry.priority !== 'NORMAL' || entry.currentObservations < entry.targetObservations)
        .sort((a, b) => {
            const priorityOrder: Record<ResamplingRecommendation['priority'], number> = {
                MAX: 0,
                HIGH: 1,
                MED: 2,
                NORMAL: 3,
            };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return a.context.wilsonLower - b.context.wilsonLower;
        })
        .slice(0, 12);

    const fusionInsights = buildFusionInsights(fusionSamples);

    const analysis: TrainingAnalysis = {
        totalContexts,
        contextsWithSolidData,
        contextsNeedingData,
        averageBestWinRate,
        bestContext,
        topContexts,
        strugglingContexts,
        dataGaps,
        coverageByTokenDelta,
        heroMatchupInsights,
        elementCounterInsights,
        mechanicEffectiveness,
        resamplingPlan,
        decisionEntropyAlerts: entropyAlerts.slice(0, 10),
        fusionInsights,
    };

    const trainedModel = buildRunenkriegModel(modelData, contextMetadata, analysis);

    const finalMessage = preferGpu
        ? gpuUtilized
            ? 'Training abgeschlossen. GPU-Beschleunigung aktiv.'
            : 'Training abgeschlossen. GPU nicht verfügbar – CPU genutzt.'
        : 'Training abgeschlossen.';
    onProgress?.({ phase: 'finalizing', progress: 1, message: finalMessage });

    return trainedModel;
}

const RUNENKRIEG_MODEL_VERSION = 1;

function inflateSerializedRunenkriegModel(
    serialized: SerializedRunenkriegModel
): {
    modelData: Map<string, Map<string, { wins: number; total: number }>>;
    metadataMap: Map<string, ContextMetadata>;
} {
    const modelData = new Map<string, Map<string, { wins: number; total: number }>>();
    const metadataMap = new Map<string, ContextMetadata>();

    const entries = Object.entries(serialized.contexts ?? {});
    for (const [contextKey, contextValue] of entries) {
        const aiMap = new Map<string, { wins: number; total: number }>();
        const cardEntries = Object.entries(contextValue?.aiCards ?? {});
        for (const [cardKey, stats] of cardEntries) {
            aiMap.set(cardKey, { wins: stats.wins, total: stats.total });
        }
        modelData.set(contextKey, aiMap);

        if (contextValue?.metadata) {
            metadataMap.set(contextKey, {
                ...contextValue.metadata,
                preferredResponses: contextValue.metadata.preferredResponses
                    ? [...contextValue.metadata.preferredResponses]
                    : undefined,
            });
        }
    }

    return { modelData, metadataMap };
}

function buildRunenkriegModel(
    modelData: Map<string, Map<string, { wins: number; total: number }>>,
    contextMetadata: Map<string, ContextMetadata>,
    analysis: TrainingAnalysis
): TrainedModel {
    const predict = (playerCard: Card, aiHand: Card[], gameState: any): Card => {
        const tokenDelta = (gameState.playerTokens ?? 0) - (gameState.aiTokens ?? 0);
        const clampedDelta = clampTokenDelta(tokenDelta);
        const heroMatchupKey = `${gameState.playerHero}vs${gameState.aiHero}`;
        const contextKey = `${playerCard.element} ${playerCard.wert}|${gameState.weather}|${heroMatchupKey}|delta:${clampedDelta}`;
        const possiblePlays = modelData.get(contextKey);
        const metadata = contextMetadata.get(contextKey);

        if (!possiblePlays || aiHand.length === 0) {
            const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
            return sortedHand[0] || aiHand[Math.floor(Math.random() * aiHand.length)];
        }

        const baseline = metadata?.baselineWinRate ?? 0.45;
        const defaultLower = Math.max(0, baseline - 0.25);
        const defaultUpper = Math.min(1, baseline + 0.15);

        const weaknessPenalty = metadata?.weaknessPenalty ?? 0;
        const preferredResponses = metadata?.preferredResponses ?? [];

        const candidateSummaries = aiHand.map((card) => {
            const key = `${card.element} ${card.wert}`;
            const stats = possiblePlays.get(key);
            if (!stats || stats.total === 0) {
                const isPreferred = preferredResponses.includes(key);
                const baseLower = defaultLower;
                const adjustedLower = Math.min(
                    1,
                    Math.max(0, baseLower - weaknessPenalty + (isPreferred ? 0.08 : 0))
                );
                return {
                    card,
                    key,
                    winRate: baseline,
                    wilsonLower: baseLower,
                    wilsonUpper: Math.min(1, defaultUpper + (isPreferred ? 0.05 : 0)),
                    intervalWidth: defaultUpper - defaultLower,
                    observations: stats?.total ?? 0,
                    adjustedLower,
                    isPreferred,
                };
            }
            const interval = wilsonInterval(stats.wins, stats.total);
            const isPreferred = preferredResponses.includes(key);
            const adjustedLower = Math.min(
                1,
                Math.max(0, interval.lower - weaknessPenalty + (isPreferred ? 0.08 : 0))
            );
            return {
                card,
                key,
                winRate: stats.wins / stats.total,
                wilsonLower: interval.lower,
                wilsonUpper: Math.min(1, interval.upper + (isPreferred ? 0.05 : 0)),
                intervalWidth: interval.width,
                observations: stats.total,
                adjustedLower,
                isPreferred,
            };
        });

        const sortedByEvidence = [...candidateSummaries].sort((a, b) => {
            if (b.adjustedLower !== a.adjustedLower) {
                return b.adjustedLower - a.adjustedLower;
            }
            if (a.isPreferred !== b.isPreferred) {
                return (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0);
            }
            return b.wilsonLower - a.wilsonLower;
        });
        const topCandidate = sortedByEvidence[0];
        if (!topCandidate) {
            const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
            return sortedHand[0];
        }

        const entropyLow = (metadata?.entropy ?? 1) < 0.3;
        if (metadata?.consolidationStage === 'stable') {
            if (entropyLow && sortedByEvidence.length > 1) {
                const secondCandidate = sortedByEvidence[1];
                const mixChance = 0.15;
                return Math.random() < mixChance ? secondCandidate.card : topCandidate.card;
            }
            return topCandidate.card;
        }

        let temperature = metadata?.consolidationStage === 'provisional' ? 1.0 : 1.4;
        if (entropyLow) {
            temperature += 0.4;
        }

        if (weaknessPenalty > 0) {
            temperature += weaknessPenalty * 2.5;
        }

        const adjustedScores = sortedByEvidence.map((entry) => entry.adjustedLower);
        const maxScore = adjustedScores.length > 0 ? Math.max(...adjustedScores) : 0;
        const weights = sortedByEvidence.map((entry) =>
            Math.exp((entry.adjustedLower - maxScore) / Math.max(0.4, temperature))
        );
        const weightSum = weights.reduce((sum, value) => sum + value, 0);
        if (weightSum === 0) {
            return topCandidate.card;
        }

        let threshold = Math.random() * weightSum;
        for (let i = 0; i < sortedByEvidence.length; i++) {
            threshold -= weights[i];
            if (threshold <= 0) {
                return sortedByEvidence[i].card;
            }
        }

        return topCandidate.card;
    };

    const serialize = (): SerializedRunenkriegModel => {
        const contexts: SerializedRunenkriegModel['contexts'] = {};
        modelData.forEach((aiCardMap, contextKey) => {
            const aiCards: Record<string, { wins: number; total: number }> = {};
            aiCardMap.forEach((stats, cardKey) => {
                aiCards[cardKey] = { wins: stats.wins, total: stats.total };
            });
            const metadata = contextMetadata.get(contextKey);
            contexts[contextKey] = {
                aiCards,
                ...(metadata
                    ? {
                          metadata: {
                              ...metadata,
                              preferredResponses: metadata.preferredResponses
                                  ? [...metadata.preferredResponses]
                                  : undefined,
                          },
                      }
                    : {}),
            };
        });

        return {
            version: RUNENKRIEG_MODEL_VERSION,
            generatedAt: new Date().toISOString(),
            contexts,
            analysis: JSON.parse(JSON.stringify(analysis)) as TrainingAnalysis,
        };
    };

    return { predict, analysis, serialize };
}

export function hydrateTrainedModel(serialized: SerializedRunenkriegModel): TrainedModel {
    if (!serialized || typeof serialized !== 'object') {
        throw new Error('Ungültiges Runenkrieg-Modellformat.');
    }

    if (serialized.version !== RUNENKRIEG_MODEL_VERSION) {
        console.warn(
            `Geladenes Runenkrieg-Modell hat Version ${serialized.version}, erwartet ${RUNENKRIEG_MODEL_VERSION}.`
        );
    }

    const { modelData, metadataMap } = inflateSerializedRunenkriegModel(serialized);

    return buildRunenkriegModel(modelData, metadataMap, serialized.analysis);
}

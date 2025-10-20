import {
    ABILITIES,
    ELEMENT_SYNERGIES,
    HEROES,
} from '../../constants';
import {
    Card,
    GameHistoryEntry,
    HeroName,
    WeatherType,
} from '../../types';
import {
    evaluateElementSynergy,
    evaluateRiskAndWeather,
} from '../mechanicEngine';
import {
    FusionDecision,
    RKFusionContext,
    RKFusionPolicy,
    RKFusionOutcome,
} from './policy/RKFusionPolicy';

let fusionIdCounter = 0;

const abilityIndex = (value: Card['wert']) => ABILITIES.indexOf(value);

const determineFusionElement = (first: Card, second: Card): Card['element'] => {
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
    const mergedMechanics = Array.from(new Set([...primary.mechanics, ...secondary.mechanics, 'Fusion']));
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

type CandidateEvaluation = {
    indices: [number, number];
    fused: Card;
    baseGain: number;
    elementSynergy: number;
    synergyScore: number;
    weatherScore: number;
    heroBonus: number;
    tokenPressure: number;
    totalScore: number;
};

const evaluateCandidate = (
    hand: Card[],
    hero: HeroName,
    opponentHero: HeroName,
    ownerTokens: number,
    opponentTokens: number,
    weather: WeatherType,
    history: GameHistoryEntry[],
    actor: 'spieler' | 'gegner'
): CandidateEvaluation | null => {
    const fusionCandidates = hand
        .map((card, index) => ({ card, index }))
        .filter((entry) => entry.card.mechanics.includes('Fusion'));

    if (fusionCandidates.length < 2) {
        return null;
    }

    const historyPressure = computeHistoryPressure(history, actor);

    let best: CandidateEvaluation | null = null;

    for (let i = 0; i < fusionCandidates.length - 1; i++) {
        for (let j = i + 1; j < fusionCandidates.length; j++) {
            const first = fusionCandidates[i];
            const second = fusionCandidates[j];
            const fusedCard = createFusionCard(first.card, second.card);
            const fusedAbilityIndex = abilityIndex(fusedCard.wert);
            const baseGain = fusedAbilityIndex - Math.max(
                abilityIndex(first.card.wert),
                abilityIndex(second.card.wert)
            );
            const elementSynergy = first.card.element === second.card.element ? 0.5 : 0;
            const remainingHand = hand.filter((_, idx) => idx !== first.index && idx !== second.index);
            const synergyScore = evaluateElementSynergy(
                fusedCard,
                remainingHand,
                history,
                actor === 'spieler' ? 'player' : 'ai'
            );
            const weatherScore = evaluateRiskAndWeather(
                fusedCard,
                ownerTokens,
                opponentTokens,
                weather
            );
            const heroBonus = HEROES[hero].Element === fusedCard.element ? HEROES[hero].Bonus : 0;
            const tokenPressure = (opponentTokens - ownerTokens) * 0.12;
            const totalScore =
                baseGain +
                elementSynergy +
                synergyScore * 0.5 +
                weatherScore * 0.35 +
                heroBonus * 0.25 +
                historyPressure +
                tokenPressure;

            if (!best || totalScore > best.totalScore) {
                best = {
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

    return best;
};

const buildContext = (
    params: {
        actor: 'spieler' | 'gegner';
        hero: HeroName;
        opponentHero: HeroName;
        weather: WeatherType;
        roundNumber: number;
        hand: Card[];
        candidate: CandidateEvaluation;
        ownerTokens: number;
        opponentTokens: number;
        history: GameHistoryEntry[];
    }
): RKFusionContext => {
    const abilityValues = params.hand.map((card) => abilityIndex(card.wert));
    const fusionReady = params.hand.filter((card) => card.mechanics.includes('Fusion')).length;
    const historyPressure = computeHistoryPressure(params.history, params.actor);

    return {
        actor: params.actor,
        hero: params.hero,
        opponentHero: params.opponentHero,
        weather: params.weather,
        roundNumber: params.roundNumber,
        handSignature: createHandSignature(params.hand),
        handSummary: {
            size: params.hand.length,
            fusionReady,
            averageAbilityIdx: abilityValues.length === 0
                ? 0
                : abilityValues.reduce((sum, value) => sum + value, 0) / abilityValues.length,
            maxAbilityIdx: abilityValues.length === 0 ? 0 : Math.max(...abilityValues),
            minAbilityIdx: abilityValues.length === 0 ? 0 : Math.min(...abilityValues),
        },
        boardSummary: {
            round: params.roundNumber,
            ownTokens: params.ownerTokens,
            opponentTokens: params.opponentTokens,
            tokenDiff: params.ownerTokens - params.opponentTokens,
            ownMorale: historyPressure,
        },
        candidate: {
            indices: params.candidate.indices,
            fusedCard: params.candidate.fused,
            projectedGain: params.candidate.totalScore,
            baseGain: params.candidate.baseGain,
            elementSynergy: params.candidate.elementSynergy,
            synergyScore: params.candidate.synergyScore,
            weatherScore: params.candidate.weatherScore,
            heroBonus: params.candidate.heroBonus,
            tokenPressure: params.candidate.tokenPressure,
            historyPressure,
        },
    };
};

export class RKFusionEngine {
    constructor(private readonly policy: RKFusionPolicy) {}

    decideAndExecute(
        hand: Card[],
        hero: HeroName,
        opponentHero: HeroName,
        ownerTokens: number,
        opponentTokens: number,
        weather: WeatherType,
        roundNumber: number,
        history: GameHistoryEntry[],
        actor: 'spieler' | 'gegner'
    ): {
        updatedHand: Card[];
        fusedCard: Card | null;
        isFused: boolean;
        decision?: FusionDecision;
    } {
        const candidate = evaluateCandidate(
            hand,
            hero,
            opponentHero,
            ownerTokens,
            opponentTokens,
            weather,
            history,
            actor
        );

        if (!candidate) {
            return { updatedHand: [...hand], fusedCard: null, isFused: false };
        }

        const context: RKFusionContext = buildContext({
            actor,
            hero,
            opponentHero,
            weather,
            roundNumber,
            hand,
            candidate,
            ownerTokens,
            opponentTokens,
            history,
        });

        const action = this.policy.selectAction(context);
        const decision: FusionDecision = { ...action, ctx: context };

        if (action.action !== 'fuse') {
            return { updatedHand: [...hand], fusedCard: null, isFused: false, decision };
        }

        const updatedHand = [...hand];
        const indices = [...candidate.indices].sort((a, b) => b - a);
        for (const idx of indices) {
            updatedHand.splice(idx, 1);
        }
        updatedHand.push(candidate.fused);

        return { updatedHand, fusedCard: candidate.fused, isFused: true, decision };
    }

    learn(decision: FusionDecision, outcome: RKFusionOutcome): void {
        this.policy.learn(decision, outcome);
    }
}

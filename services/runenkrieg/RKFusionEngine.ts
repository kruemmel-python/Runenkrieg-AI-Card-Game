import {
    Card,
    GameHistoryEntry,
    HeroName,
    WeatherType,
    AbilityMechanicName,
} from '../../types';
import {
    ABILITIES,
    ELEMENT_SYNERGIES,
    HEROES,
} from '../../constants';
import {
    evaluateElementSynergy,
    evaluateRiskAndWeather,
} from '../mechanicEngine';
import {
    FusionDecision,
    FusionAction,
    RKFusionCandidate,
    RKFusionContext,
    RKFusionOutcome,
    RKFusionPolicy,
} from './policy/RKFusionPolicy';
import { BanditPolicy } from './policy/BanditPolicy';

const abilityIndex = (value: Card['wert']) => ABILITIES.indexOf(value);

let fusionIdCounter = 0;

const safeMechanics = (card: Card): AbilityMechanicName[] =>
    Array.isArray(card.mechanics) ? (card.mechanics as AbilityMechanicName[]) : [];

const determineFusionElement = (first: Card, second: Card) => {
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
        ...safeMechanics(primary),
        ...safeMechanics(secondary),
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

const computeHandSummary = (hand: Card[]) => {
    if (hand.length === 0) {
        return {
            maxAbilityIdx: 0,
            averageAbilityIdx: 0,
            fusionCount: 0,
        };
    }

    const indices = hand.map((card) => abilityIndex(card.wert));
    const maxAbilityIdx = Math.max(...indices);
    const averageAbilityIdx = indices.reduce((sum, value) => sum + value, 0) / hand.length;
    const fusionCount = hand.filter((card) => safeMechanics(card).includes('Fusion')).length;

    return {
        maxAbilityIdx,
        averageAbilityIdx,
        fusionCount,
    };
};

const computeBoardSummary = (
    ownerTokens: number,
    opponentTokens: number,
    history: GameHistoryEntry[],
    actor: 'spieler' | 'gegner',
    roundNumber: number
) => {
    const tokenDelta = ownerTokens - opponentTokens;
    const ownMorale = computeHistoryPressure(history, actor);

    return {
        ownTokens: ownerTokens,
        opponentTokens,
        tokenDelta,
        ownMorale,
        roundNumber,
    };
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
): RKFusionCandidate | null => {
    const fusionCandidates = hand
        .map((card, index) => ({ card, index }))
        .filter((entry) => safeMechanics(entry.card).includes('Fusion'));

    if (fusionCandidates.length < 2) {
        return null;
    }

    const historyPressure = computeHistoryPressure(history, actor);
    let bestPair: RKFusionCandidate | null = null;

    for (let i = 0; i < fusionCandidates.length - 1; i++) {
        for (let j = i + 1; j < fusionCandidates.length; j++) {
            const first = fusionCandidates[i];
            const second = fusionCandidates[j];
            const fusedCard = createFusionCard(first.card, second.card);
            const fusedAbilityIndex = abilityIndex(fusedCard.wert);
            const baseGain =
                fusedAbilityIndex -
                Math.max(abilityIndex(first.card.wert), abilityIndex(second.card.wert));
            const elementSynergy = first.card.element === second.card.element ? 0.5 : 0;
            const remainingHand = hand.filter((_, index) => index !== first.index && index !== second.index);
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

            if (!bestPair || totalScore > bestPair.totalScore) {
                bestPair = {
                    indices: [first.index, second.index],
                    fusedCard,
                    baseGain,
                    projectedGain: totalScore,
                    elementSynergy,
                    synergyScore,
                    weatherScore,
                    heroBonus,
                    tokenPressure,
                    historyPressure,
                    totalScore,
                };
            }
        }
    }

    return bestPair;
};

export interface FusionExecutionResult {
    updatedHand: Card[];
    decision?: FusionDecision;
    isFused: boolean;
    fusedCard?: Card;
}

export interface RKFusionEngineOptions {
    onPolicyLearn?: (policy: BanditPolicy) => void;
}

export class RKFusionEngine {
    constructor(private readonly policy: RKFusionPolicy, private readonly options: RKFusionEngineOptions = {}) {}

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
    ): FusionExecutionResult {
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
            return {
                updatedHand: [...hand],
                isFused: false,
            };
        }

        const context: RKFusionContext = {
            actor,
            hero,
            opponentHero,
            weather,
            hand: [...hand],
            roundNumber,
            handSummary: computeHandSummary(hand),
            boardSummary: computeBoardSummary(ownerTokens, opponentTokens, history, actor, roundNumber),
            candidate,
        };

        const action: FusionAction = this.policy.decide(context);
        const decision: FusionDecision = { ctx: context, action };

        if (action !== 'fuse') {
            return {
                updatedHand: [...hand],
                decision,
                isFused: false,
            };
        }

        const updatedHand = [...hand];
        const indices = [...candidate.indices].sort((a, b) => b - a);
        indices.forEach((index) => {
            updatedHand.splice(index, 1);
        });
        updatedHand.push(candidate.fusedCard);

        return {
            updatedHand,
            decision,
            isFused: true,
            fusedCard: candidate.fusedCard,
        };
    }

    learn(decision: FusionDecision, outcome: RKFusionOutcome): void {
        this.policy.learn(decision, outcome);
        if (this.options.onPolicyLearn && this.policy instanceof BanditPolicy) {
            this.options.onPolicyLearn(this.policy);
        }
    }
}

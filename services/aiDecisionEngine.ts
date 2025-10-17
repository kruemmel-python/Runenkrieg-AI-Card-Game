import {
    ABILITIES,
    ABILITY_MECHANIC_DEFINITIONS,
    ELEMENT_HIERARCHIE,
    ELEMENT_SYNERGIES,
    HEROES,
    WEATHER_EFFECTS,
} from '../constants';
import {
    AiGameState,
    AiPlayDecision,
    Card,
    ElementType,
    GameHistoryEntry,
    HeroName,
    WeatherType,
} from '../types';
import { createFusionCard, isFusionResult } from './fusionService';

interface StrategyProfile {
    dominantElement: ElementType | null;
    secondaryElement: ElementType | null;
}

const getElementAdvantage = (attacking: ElementType, defending: ElementType): number => {
    return ELEMENT_HIERARCHIE[attacking]?.[defending] ?? 0;
};

const getWeatherModifier = (weather: WeatherType, element: ElementType): number => {
    return (WEATHER_EFFECTS[weather] as Record<ElementType, number> | undefined)?.[element] ?? 0;
};

const countElements = (cards: Card[] = []): Partial<Record<ElementType, number>> => {
    return cards.reduce<Partial<Record<ElementType, number>>>((acc, card) => {
        acc[card.element] = (acc[card.element] ?? 0) + 1;
        return acc;
    }, {});
};

const detectStrategyProfile = (history: GameHistoryEntry[]): StrategyProfile => {
    const elementCounter: Partial<Record<ElementType, number>> = {};
    history.forEach(entry => {
        if (entry.playerCard) {
            const element = entry.playerCard.element;
            elementCounter[element] = (elementCounter[element] ?? 0) + 1;
        }
    });

    const sorted = Object.entries(elementCounter) as [ElementType, number][];
    sorted.sort((a, b) => b[1] - a[1]);

    return {
        dominantElement: sorted[0]?.[1] && sorted[0][1] >= 2 ? sorted[0][0] : null,
        secondaryElement: sorted[1]?.[1] && sorted[1][1] >= 2 ? sorted[1][0] : null,
    };
};

const evaluateMechanics = (card: Card, state: AiGameState): number => {
    let mechanicScore = 0;

    card.mechanics.forEach(mechanic => {
        const definition = ABILITY_MECHANIC_DEFINITIONS[mechanic];
        if (!definition) return;

        mechanicScore += definition.weight;

        if (mechanic === 'Überladung') {
            mechanicScore += state.aiTokens > state.playerTokens ? 1 : -1.5;
        }

        if (mechanic === 'Ketteneffekte') {
            const lastEntry = state.history[state.history.length - 1];
            if (lastEntry?.aiCard?.mechanics.includes('Ketteneffekte')) {
                mechanicScore += 1.2;
            }
        }

        if (mechanic === 'Elementarresonanz' && state.aiHandPreview) {
            const sameElement = state.aiHandPreview.filter(c => c.element === card.element && c.id !== card.id).length;
            mechanicScore += sameElement * 0.75;
        }

        if (mechanic === 'Fusion') {
            if (isFusionResult(card)) {
                mechanicScore += 2.5;
            } else if (state.aiHandPreview) {
                const partners = state.aiHandPreview.filter(c => c.element !== card.element && c.mechanics.includes('Fusion')).length;
                if (partners > 0) mechanicScore += 1 + partners * 0.25;
            }
        }

        if (mechanic === 'Wetterbindung') {
            const weatherMod = getWeatherModifier(state.weather, card.element);
            mechanicScore += weatherMod >= 0 ? weatherMod + 0.5 : weatherMod - 0.5;
        }
    });

    if (card.cardType === 'Artefakt' && state.aiHandPreview) {
        const artifacts = state.aiHandPreview.filter(c => c.cardType === 'Artefakt').length;
        mechanicScore += artifacts > 1 ? 1 : 0.3;
    }

    if (card.cardType === 'Segen/Fluch') {
        mechanicScore += state.aiTokens < state.playerTokens ? 1.4 : 0.2;
    }

    if (card.cardType === 'Beschwörung' && card.lifespan) {
        mechanicScore += Math.max(0, 4 - card.lifespan) * 0.3;
    }

    if (card.cardType === 'Runenstein') {
        mechanicScore += 1;
    }

    if (isFusionResult(card)) {
        mechanicScore += 1.25; // reward for unleashing a completed fusion
    }

    return mechanicScore;
};

const evaluateSynergyPotential = (card: Card, state: AiGameState): number => {
    let synergyScore = 0;

    if (state.aiHandPreview) {
        const elementCounts = countElements(state.aiHandPreview);
        const allies = elementCounts[card.element] ?? 0;
        if (allies > 1) {
            synergyScore += allies * 0.5;
        }
    }

    ELEMENT_SYNERGIES.forEach(synergy => {
        if (!synergy.elements.includes(card.element)) return;
        const partner = synergy.elements.find(el => el !== card.element)!;

        const hasPartnerInHand = state.aiHandPreview?.some(c => c.element === partner && c.id !== card.id) ?? false;
        const hasPartnerInHistory = state.history.some(entry => entry.aiCard?.element === partner);
        if (hasPartnerInHand || hasPartnerInHistory) {
            synergyScore += synergy.modifier;
        }
    });

    return synergyScore;
};

const evaluateCounterplay = (card: Card, playerCard: Card, profile: StrategyProfile): number => {
    let counterScore = getElementAdvantage(card.element, playerCard.element) * 1.2;

    if (profile.dominantElement) {
        counterScore += getElementAdvantage(card.element, profile.dominantElement) * 1.1;
    }

    if (profile.secondaryElement) {
        counterScore += getElementAdvantage(card.element, profile.secondaryElement) * 0.8;
    }

    if (playerCard.cardType === 'Segen/Fluch' && card.cardType === 'Artefakt') {
        counterScore += 1;
    }

    return counterScore;
};

const evaluateCard = (playerCard: Card, candidate: Card, state: AiGameState): number => {
    const baseStrength = ABILITIES.indexOf(candidate.wert);
    const weatherModifier = getWeatherModifier(state.weather, candidate.element);
    const mechanicScore = evaluateMechanics(candidate, state);
    const synergyScore = evaluateSynergyPotential(candidate, state);
    const profile = detectStrategyProfile(state.history);
    const counterScore = evaluateCounterplay(candidate, playerCard, profile);
    const heroAffinity = HEROES[state.aiHero].Element === candidate.element ? HEROES[state.aiHero].Bonus : 0;

    const pressure = state.playerTokens - state.aiTokens;
    const riskMitigation = pressure > 1 && candidate.cardType === 'Verbündeter' ? 1 : 0;

    const adaptiveModifier = profile.dominantElement === 'Chaos' ? 1 : 0;

    return (
        baseStrength * 1.1 +
        weatherModifier * 1.2 +
        mechanicScore * 1.15 +
        synergyScore * 1.05 +
        counterScore +
        heroAffinity * 1.25 +
        riskMitigation -
        pressure * (candidate.mechanics.includes('Überladung') ? 0.5 : 0) +
        adaptiveModifier
    );
};

export interface AiPlayOption {
    decision: AiPlayDecision;
    score: number;
}

const uniquePairs = (cards: Card[]): [Card, Card][] => {
    const pairs: [Card, Card][] = [];
    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            pairs.push([cards[i], cards[j]]);
        }
    }
    return pairs;
};

export const generateAiPlayOptions = (
    playerCard: Card,
    aiHand: Card[],
    gameState: AiGameState
): AiPlayOption[] => {
    if (aiHand.length === 0) {
        return [];
    }

    const options: AiPlayOption[] = [];
    const augmentedBaseState: AiGameState = {
        ...gameState,
        aiHandPreview: gameState.aiHandPreview ?? aiHand,
    };

    aiHand.forEach(card => {
        const score = evaluateCard(playerCard, card, augmentedBaseState);
        options.push({
            decision: {
                card,
                consumedCardIds: [card.id],
            },
            score,
        });
    });

    const fusionCandidates = aiHand.filter(card => card.mechanics.includes('Fusion'));
    uniquePairs(fusionCandidates).forEach(([first, second]) => {
        const fusedCard = createFusionCard(first, second);
        const preview = aiHand.filter(c => c.id !== first.id && c.id !== second.id);
        const fusionState: AiGameState = {
            ...augmentedBaseState,
            aiHandPreview: preview,
        };
        const fusionScore = evaluateCard(playerCard, fusedCard, fusionState) + 1.5;
        options.push({
            decision: {
                card: fusedCard,
                consumedCardIds: [first.id, second.id],
                createdByFusion: true,
                fusionSources: [first, second],
            },
            score: fusionScore,
        });
    });

    return options;
};

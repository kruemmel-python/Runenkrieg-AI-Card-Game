import { Card, HeroName, WeatherType } from '../../../types';

export type FusionAction = 'fuse' | 'skip';

export interface RKFusionHandSummary {
    maxAbilityIdx: number;
    averageAbilityIdx: number;
    fusionCount: number;
}

export interface RKFusionBoardSummary {
    ownTokens: number;
    opponentTokens: number;
    tokenDelta: number;
    ownMorale: number;
    roundNumber: number;
}

export interface RKFusionCandidate {
    indices: [number, number];
    fusedCard: Card;
    baseGain: number;
    projectedGain: number;
    elementSynergy: number;
    synergyScore: number;
    weatherScore: number;
    heroBonus: number;
    tokenPressure: number;
    historyPressure: number;
    totalScore: number;
}

export interface RKFusionContext {
    actor: 'spieler' | 'gegner';
    hero: HeroName;
    opponentHero: HeroName;
    weather: WeatherType;
    hand: Card[];
    roundNumber: number;
    handSummary: RKFusionHandSummary;
    boardSummary: RKFusionBoardSummary;
    candidate: RKFusionCandidate;
}

export interface FusionDecision {
    ctx: RKFusionContext;
    action: FusionAction;
}

export interface RKFusionOutcome {
    roundWinner: 'self' | 'opponent' | 'draw';
    tokenChange: number;
}

export interface RKFusionPolicy {
    decide(context: RKFusionContext): FusionAction;
    learn(decision: FusionDecision, outcome: RKFusionOutcome): void;
}

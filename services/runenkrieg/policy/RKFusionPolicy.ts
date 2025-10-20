import { Card, HeroName, WeatherType } from '../../../types';

export interface RKFusionHandSummary {
    size: number;
    fusionReady: number;
    averageAbilityIdx: number;
    maxAbilityIdx: number;
    minAbilityIdx: number;
}

export interface RKFusionBoardSummary {
    round: number;
    ownTokens: number;
    opponentTokens: number;
    tokenDiff: number;
    ownMorale: number;
}

export interface RKFusionCandidate {
    indices: [number, number];
    fusedCard: Card;
    projectedGain: number;
    baseGain: number;
    elementSynergy: number;
    synergyScore: number;
    weatherScore: number;
    heroBonus: number;
    tokenPressure: number;
    historyPressure: number;
}

export interface RKFusionContext {
    actor: 'spieler' | 'gegner';
    hero: HeroName;
    opponentHero: HeroName;
    weather: WeatherType;
    roundNumber: number;
    handSignature: string;
    handSummary: RKFusionHandSummary;
    boardSummary: RKFusionBoardSummary;
    candidate: RKFusionCandidate;
}

export interface RKFusionOutcome {
    roundWinner: 'self' | 'opponent' | 'draw';
    tokenChange: number;
}

export interface PolicyAction {
    action: 'fuse' | 'skip';
    armId: string;
}

export interface FusionDecision extends PolicyAction {
    ctx: RKFusionContext;
}

export interface RKFusionPolicy {
    selectAction(context: RKFusionContext): PolicyAction;
    learn(decision: FusionDecision, outcome: RKFusionOutcome): void;
}

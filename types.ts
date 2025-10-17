import {
  ELEMENTS,
  ABILITIES,
  HEROES,
  WEATHER_EFFECTS,
  CARD_TYPES,
  ABILITY_MECHANIC_DEFINITIONS
} from './constants';

export type ElementType = typeof ELEMENTS[number];
export type ValueType = typeof ABILITIES[number];
export type HeroName = keyof typeof HEROES;
export type WeatherType = keyof typeof WEATHER_EFFECTS;
export type CardTypeName = typeof CARD_TYPES[number]['name'];
export type AbilityMechanicName = keyof typeof ABILITY_MECHANIC_DEFINITIONS;
export type Winner = "spieler" | "gegner" | "unentschieden";

export interface Card {
  element: ElementType;
  wert: ValueType;
  id: string;
  cardType: CardTypeName;
  mechanics: AbilityMechanicName[];
  lifespan?: number;
  charges?: number;
}

export interface Player {
  hand: Card[];
  tokens: number;
  hero: HeroName;
}

export interface RoundResult {
  spieler_karte: string;
  gegner_karte: string;
  spieler_token_vorher: number;
  gegner_token_vorher: number;
  spieler_token: number;
  gegner_token: number;
  wetter: WeatherType;
  spieler_held: HeroName;
  gegner_held: HeroName;
  gewinner: Winner;
}

export interface SimulationAnalysis {
  totalRounds: number;
  playerWins: number;
  aiWins: number;
  draws: number;
  playerWinRate: number;
  aiWinRate: number;
  averagePlayerTokens: number;
  averageAiTokens: number;
  mostCommonPlayerCard: string | null;
  mostCommonAiCard: string | null;
  mostCommonWeather: WeatherType | null;
  mostCommonPlayerHero: HeroName | null;
  mostCommonAiHero: HeroName | null;
}

export interface ContextInsight {
  playerCard: string;
  weather: WeatherType;
  playerHero: HeroName;
  aiHero: HeroName;
  tokenDelta: number;
  aiCard: string;
  winRate: number;
  baselineWinRate: number;
  lift: number;
  observations: number;
  wilsonLower: number;
  wilsonUpper: number;
  intervalWidth: number;
  evidenceScore: number;
  entropy: number;
}

export interface TokenDeltaCoverage {
  tokenDelta: number;
  contextCount: number;
  solidDataContexts: number;
  averageWinRate: number;
  averageBaseline: number;
  averageLift: number;
  averageObservations: number;
}

export interface HeroMatchupInsight {
  playerHero: HeroName;
  aiHero: HeroName;
  contexts: number;
  observations: number;
  averageBestWinRate: number;
  averageTokenDelta: number;
  topCounter?: ContextInsight;
}

export interface ElementCounterInsight {
  playerElement: ElementType;
  counters: {
    aiCard: string;
    winRate: number;
    observations: number;
  }[];
}

export interface MechanicEffectivenessInsight {
  mechanic: AbilityMechanicName;
  winRate: number;
  observations: number;
  normalizedLift: number;
  contexts: number;
  averageTokenDelta: number;
  weatherDistribution: { weather: WeatherType; share: number }[];
}

export interface ResamplingRecommendation {
  context: ContextInsight;
  priority: 'MAX' | 'HIGH' | 'MED' | 'NORMAL';
  wave: 1 | 2 | 3;
  currentObservations: number;
  targetObservations: number;
  rationale: string;
}

export interface TrainingAnalysis {
  totalContexts: number;
  contextsWithSolidData: number;
  contextsNeedingData: number;
  averageBestWinRate: number;
  bestContext?: ContextInsight;
  topContexts: ContextInsight[];
  strugglingContexts: ContextInsight[];
  dataGaps: ContextInsight[];
  coverageByTokenDelta: TokenDeltaCoverage[];
  heroMatchupInsights: HeroMatchupInsight[];
  elementCounterInsights: ElementCounterInsight[];
  mechanicEffectiveness: MechanicEffectivenessInsight[];
  resamplingPlan: ResamplingRecommendation[];
  decisionEntropyAlerts: ContextInsight[];
}

export interface TrainedModel {
  predict: (playerCard: Card, aiHand: Card[], gameState: any) => Card;
  analysis: TrainingAnalysis;
}

export interface GameHistoryEntry {
  round: number;
  playerCard: Card;
  aiCard: Card;
  weather: WeatherType;
  winner: Winner;
  playerTokens: number;
  aiTokens: number;
}
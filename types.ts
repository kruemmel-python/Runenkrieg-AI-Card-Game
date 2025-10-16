import { ELEMENTS, ABILITIES, HEROES, WEATHER_EFFECTS } from './constants';

export type ElementType = typeof ELEMENTS[number];
export type ValueType = typeof ABILITIES[number];
export type HeroName = keyof typeof HEROES;
export type WeatherType = keyof typeof WEATHER_EFFECTS;
export type Winner = "spieler" | "gegner" | "unentschieden";

export interface Card {
  element: ElementType;
  wert: ValueType;
  id: string;
}

export interface Player {
  hand: Card[];
  tokens: number;
  hero: HeroName;
}

export interface RoundResult {
  spieler_karte: string;
  gegner_karte: string;
  spieler_token: number;
  gegner_token: number;
  wetter: WeatherType;
  spieler_held: HeroName;
  gegner_held: HeroName;
  gewinner: Winner;
}

export interface TrainedModel {
  predict: (playerCard: Card, aiHand: Card[], gameState: any) => Card;
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
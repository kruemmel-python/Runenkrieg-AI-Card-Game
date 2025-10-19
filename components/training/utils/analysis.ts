import { HeroName, RoundResult, SimulationAnalysis, WeatherType } from '../../../types';

const getMostFrequent = <T,>(items: T[]): T | null => {
  if (items.length === 0) {
    return null;
  }

  const counts = new Map<T, number>();
  let bestItem: T | null = null;
  let bestCount = 0;

  for (const item of items) {
    const newCount = (counts.get(item) ?? 0) + 1;
    counts.set(item, newCount);
    if (newCount > bestCount) {
      bestCount = newCount;
      bestItem = item;
    }
  }

  return bestItem;
};

export const buildSimulationAnalysis = (data: RoundResult[]): SimulationAnalysis => {
  if (data.length === 0) {
    return {
      totalRounds: 0,
      playerWins: 0,
      aiWins: 0,
      draws: 0,
      playerWinRate: 0,
      aiWinRate: 0,
      averagePlayerTokens: 0,
      averageAiTokens: 0,
      mostCommonPlayerCard: null,
      mostCommonAiCard: null,
      mostCommonWeather: null,
      mostCommonPlayerHero: null,
      mostCommonAiHero: null,
    };
  }

  const totalRounds = data.length;
  let playerWins = 0;
  let aiWins = 0;
  let draws = 0;
  let playerTokenSum = 0;
  let aiTokenSum = 0;

  for (const round of data) {
    if (round.gewinner === 'spieler') playerWins += 1;
    if (round.gewinner === 'gegner') aiWins += 1;
    if (round.gewinner === 'unentschieden') draws += 1;

    playerTokenSum += round.spieler_token;
    aiTokenSum += round.gegner_token;
  }

  return {
    totalRounds,
    playerWins,
    aiWins,
    draws,
    playerWinRate: playerWins / totalRounds,
    aiWinRate: aiWins / totalRounds,
    averagePlayerTokens: playerTokenSum / totalRounds,
    averageAiTokens: aiTokenSum / totalRounds,
    mostCommonPlayerCard: getMostFrequent(data.map((round) => round.spieler_karte)),
    mostCommonAiCard: getMostFrequent(data.map((round) => round.gegner_karte)),
    mostCommonWeather: (getMostFrequent(data.map((round) => round.wetter)) ?? null) as WeatherType | null,
    mostCommonPlayerHero: (getMostFrequent(data.map((round) => round.spieler_held)) ?? null) as HeroName | null,
    mostCommonAiHero: (getMostFrequent(data.map((round) => round.gegner_held)) ?? null) as HeroName | null,
  };
};

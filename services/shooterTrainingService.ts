import type {
  ShooterAiInsight,
  ShooterDifficulty,
  ShooterSimulationResult,
  ShooterTrainingSummary,
  TrainedShooterModel,
} from '../types';
import { SeededRandom } from '../../React-Retro-Arcade-Space-Shooter/game/random';
import {
  computeTypeSpeed,
  getDefaultShooterProfile,
  makeBrainFromProfile,
  profileDescription,
  ShooterAiProfile,
} from '../../React-Retro-Arcade-Space-Shooter/game/enemyBrain';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface ShooterSimulationOptions {
  difficulty: ShooterDifficulty;
  profiles?: ShooterAiProfile[];
  onProgress?: (completed: number, total: number) => void;
  seed?: string;
}

interface ShooterTrainingOptions {
  onProgress?: (progress: number) => void;
}

type ShooterEnemyType = 'basic' | 'dasher' | 'heavy';

interface EnemyState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  health: number;
  maxHealth: number;
  type: ShooterEnemyType;
  cooldown: number;
  escaped: boolean;
}

interface DifficultyConfig {
  waves: number;
  playerLives: number;
  playerShield: number;
  waveDuration: number; // seconds
  spawnFactor: number;
  damageMultiplier: number;
  accuracyBonus: number;
}

const DIFFICULTY_CONFIG: Record<ShooterDifficulty, DifficultyConfig> = {
  normal: {
    waves: 5,
    playerLives: 3,
    playerShield: 60,
    waveDuration: 32,
    spawnFactor: 1,
    damageMultiplier: 1,
    accuracyBonus: 0,
  },
  veteran: {
    waves: 6,
    playerLives: 3,
    playerShield: 55,
    waveDuration: 34,
    spawnFactor: 1.15,
    damageMultiplier: 1.15,
    accuracyBonus: 0.05,
  },
  elite: {
    waves: 7,
    playerLives: 3,
    playerShield: 50,
    waveDuration: 36,
    spawnFactor: 1.3,
    damageMultiplier: 1.3,
    accuracyBonus: 0.12,
  },
};

const ARENA_WIDTH = 840;
const ARENA_HEIGHT = 1080;
const PLAYER_Y = ARENA_HEIGHT - 120;
const DT = 0.2;

const spawnEnemy = (rng: SeededRandom, wave: number, config: DifficultyConfig): EnemyState => {
  const types: ShooterEnemyType[] = ['basic', 'dasher', 'heavy'];
  const weights = [1, clamp(0.6 + wave * 0.05, 0.6, 1.4), clamp(0.3 + wave * 0.04, 0.3, 1)];
  const total = weights.reduce((sum, value) => sum + value, 0);
  const pick = rng.next() * total;
  let cumulative = 0;
  let chosen: ShooterEnemyType | null = null;
  types.forEach((type, index) => {
    cumulative += weights[index];
    if (pick <= cumulative && chosen === null) {
      chosen = type;
    }
  });
  if (!chosen) {
    chosen = 'basic';
  }
  const radius = chosen === 'heavy' ? 42 : chosen === 'dasher' ? 26 : 24;
  const maxHealth = chosen === 'heavy' ? 42 : chosen === 'dasher' ? 18 : 24;
  return {
    id: Math.floor(rng.next() * 10_000_000),
    x: clamp(rng.range(80, ARENA_WIDTH - 80), 80, ARENA_WIDTH - 80),
    y: -rng.range(60, 220),
    vx: 0,
    vy: 120,
    radius,
    health: maxHealth,
    maxHealth,
    type: chosen,
    cooldown: rng.range(0.2, 0.8),
    escaped: false,
  };
};

const applyPlayerDamage = (
  damage: number,
  state: { lives: number; shield: number; shieldMax: number }
): { livesLost: number } => {
  let remainingDamage = damage;
  let livesLost = 0;
  if (state.shield > 0) {
    const absorbed = Math.min(state.shield, remainingDamage);
    state.shield -= absorbed;
    remainingDamage -= absorbed;
  }
  if (remainingDamage > 0) {
    livesLost = Math.ceil(remainingDamage / 100);
    state.lives = Math.max(0, state.lives - livesLost);
    state.shield = state.shieldMax;
  }
  return { livesLost };
};

const chooseEnemyTarget = (enemies: EnemyState[]): EnemyState | null => {
  const alive = enemies.filter((enemy) => enemy.health > 0);
  if (alive.length === 0) {
    return null;
  }
  return alive.reduce((best, current) => (current.health < best.health ? current : best));
};

const runShooterSimulation = (
  id: number,
  profile: ShooterAiProfile,
  difficulty: ShooterDifficulty,
  rng: SeededRandom
): ShooterSimulationResult => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const brain = makeBrainFromProfile(profile);
  const player = {
    x: ARENA_WIDTH / 2,
    y: PLAYER_Y,
    vx: 0,
    vy: 0,
    lives: config.playerLives,
    shield: config.playerShield,
    shieldMax: config.playerShield,
  };
  let time = 0;
  let damageToPlayer = 0;
  let damageToEnemies = 0;
  let shotsFired = 0;
  let shotsHit = 0;
  let wavesCleared = 0;
  const enemyBreakdownMap = new Map<
    string,
    {
      enemyType: ShooterEnemyType;
      destroyed: number;
      survived: number;
      damageDealt: number;
      tags: Record<string, number>;
      encounters: number;
    }
  >();
  const decisionTagCounts: Record<string, number> = {};

  const ensureRecord = (enemyType: ShooterEnemyType) => {
    let record = enemyBreakdownMap.get(enemyType);
    if (!record) {
      record = {
        enemyType,
        destroyed: 0,
        survived: 0,
        damageDealt: 0,
        tags: {},
        encounters: 0,
      };
      enemyBreakdownMap.set(enemyType, record);
    }
    return record;
  };

  for (let wave = 1; wave <= config.waves && player.lives > 0; wave++) {
    const enemyCount = Math.round(4 * config.spawnFactor + wave * config.spawnFactor * 0.8);
    const enemies: EnemyState[] = Array.from({ length: enemyCount }, () => {
      const enemy = spawnEnemy(rng, wave, config);
      const record = ensureRecord(enemy.type);
      record.encounters += 1;
      return enemy;
    });
    const waveDurationSteps = Math.ceil(config.waveDuration / DT);

    for (let step = 0; step < waveDurationSteps && player.lives > 0; step++) {
      time += DT;
      const playerFireChance = clamp(0.24 + wave * 0.05, 0.24, 0.75);
      if (rng.next() < playerFireChance) {
        const target = chooseEnemyTarget(enemies);
        if (target) {
          const damage = 6 + wave * 1.8 + rng.range(-2, 2);
          target.health -= damage;
          damageToEnemies += Math.max(0, damage);
          if (target.health <= 0) {
            target.health = 0;
            const record = ensureRecord(target.type);
            record.destroyed += 1;
          }
        }
      }

      const aliveEnemies = enemies.filter((enemy) => enemy.health > 0);
      if (aliveEnemies.length === 0) {
        wavesCleared += 1;
        break;
      }

      for (const enemy of aliveEnemies) {
        const decision = brain({
          enemy: {
            x: enemy.x,
            y: enemy.y,
            vx: enemy.vx,
            vy: enemy.vy,
            health: enemy.health,
            maxHealth: enemy.maxHealth,
            radius: enemy.radius,
            type: enemy.type,
          },
          player: {
            x: player.x,
            y: player.y,
            vx: player.vx,
            vy: player.vy,
            shield: player.shield,
            lives: player.lives,
            score: damageToEnemies,
          },
          wave,
          dt: DT,
          rng,
        });

        const speeds = computeTypeSpeed(enemy.type);
        enemy.vx = clamp(decision.thrustX, -1, 1) * speeds.horizontal;
        enemy.vy = clamp(decision.thrustY, -1, 1) * speeds.vertical;
        enemy.x = clamp(enemy.x + enemy.vx * DT, enemy.radius, ARENA_WIDTH - enemy.radius);
        enemy.y += enemy.vy * DT;

        if (enemy.y > ARENA_HEIGHT + enemy.radius) {
          enemy.health = 0;
          enemy.escaped = true;
          continue;
        }

        enemy.cooldown -= DT;
        if (decision.fire && enemy.cooldown <= 0) {
          enemy.cooldown = decision.cooldown;
          shotsFired += 1;
          decisionTagCounts[decision.tag] = (decisionTagCounts[decision.tag] ?? 0) + 1;
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const distance = Math.max(60, Math.hypot(dx, dy));
          const travelTime = distance / decision.projectileSpeed;
          const accuracyBase = clamp(0.32 + profile.accuracy * 0.55 + config.accuracyBonus, 0.1, 0.95);
          const travelPenalty = clamp(travelTime * 0.06, 0, 0.25);
          const hitChance = clamp(accuracyBase - travelPenalty + rng.range(-0.05, 0.05), 0.05, 0.98);
          if (rng.next() < hitChance) {
            shotsHit += 1;
            const baseDamage = enemy.type === 'heavy' ? 45 : enemy.type === 'dasher' ? 32 : 28;
            const damage = baseDamage * config.damageMultiplier;
            damageToPlayer += damage;
            const record = ensureRecord(enemy.type);
            record.damageDealt += damage;
            record.tags[decision.tag] = (record.tags[decision.tag] ?? 0) + 1;
            const { livesLost } = applyPlayerDamage(damage, player);
            if (livesLost > 0 && player.lives <= 0) {
              break;
            }
          }
        }
      }
    }

    for (const enemy of enemies) {
      const record = ensureRecord(enemy.type);
      if (enemy.health > 0 || enemy.escaped) {
        record.survived += 1;
      }
    }
  }

  const totalWaves = DIFFICULTY_CONFIG[difficulty].waves;
  const playerLivesLost = Math.max(0, config.playerLives - player.lives);
  const accuracy = shotsFired > 0 ? shotsHit / shotsFired : 0;
  const score =
    damageToPlayer * 4 +
    playerLivesLost * 280 +
    accuracy * 180 +
    wavesCleared * 140 -
    damageToEnemies * 0.35;

  const enemyBreakdown = Array.from(enemyBreakdownMap.values()).map((entry) => ({
    enemyType: entry.enemyType,
    destroyed: entry.destroyed,
    survived: entry.survived,
    damageDealt: entry.damageDealt,
    tags: entry.tags,
    encounters: entry.encounters,
  }));

  return {
    id,
    profile,
    difficulty,
    wavesCleared,
    totalWaves,
    playerLivesLost,
    playerShieldRemaining: player.shield,
    damageToPlayer,
    damageToEnemies,
    shotsFired,
    shotsHit,
    completionTime: time,
    score,
    enemyBreakdown,
    decisionTags: decisionTagCounts,
  };
};

export const simulateShooterBattles = async (
  count: number,
  options: ShooterSimulationOptions
): Promise<ShooterSimulationResult[]> => {
  const simulations = Math.max(1, count);
  const rng = new SeededRandom(options.seed ?? Date.now());
  const profiles = options.profiles && options.profiles.length > 0
    ? options.profiles
    : [getDefaultShooterProfile()];
  const results: ShooterSimulationResult[] = [];
  for (let i = 0; i < simulations; i++) {
    const profile = profiles[i % profiles.length];
    const result = runShooterSimulation(i, profile, options.difficulty, rng);
    results.push(result);
    options.onProgress?.(i + 1, simulations);
    if (i % 10 === 0) {
      await Promise.resolve();
    }
  }
  return results;
};

export const summarizeShooterSimulations = (
  results: ShooterSimulationResult[]
): ShooterTrainingSummary | null => {
  if (results.length === 0) {
    return null;
  }
  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const totalWaves = results.reduce((sum, result) => sum + result.wavesCleared, 0);
  const totalLivesLost = results.reduce((sum, result) => sum + result.playerLivesLost, 0);
  const totalDamageToPlayer = results.reduce((sum, result) => sum + result.damageToPlayer, 0);
  const totalDamageToEnemies = results.reduce((sum, result) => sum + result.damageToEnemies, 0);
  const totalShots = results.reduce((sum, result) => sum + result.shotsFired, 0);
  const totalHits = results.reduce((sum, result) => sum + result.shotsHit, 0);
  const bestRun = results.reduce((best, current) => (current.score > best.score ? current : best));
  const difficultyCounts = results.reduce<Record<ShooterDifficulty, number>>((acc, result) => {
    acc[result.difficulty] = (acc[result.difficulty] ?? 0) + 1;
    return acc;
  }, { normal: 0, veteran: 0, elite: 0 });
  const recommendedDifficulty = (Object.entries(difficultyCounts) as [ShooterDifficulty, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    totalSimulations: results.length,
    averageScore: totalScore / results.length,
    bestScore: bestRun.score,
    averageWaves: totalWaves / results.length,
    averageLivesLost: totalLivesLost / results.length,
    averageDamageToPlayer: totalDamageToPlayer / results.length,
    averageDamageToEnemies: totalDamageToEnemies / results.length,
    averageAccuracy: totalShots > 0 ? totalHits / totalShots : 0,
    recommendedDifficulty,
    recommendedProfile: bestRun.profile,
    generatedAt: new Date().toISOString(),
  };
};

const buildShooterInsights = (results: ShooterSimulationResult[]): ShooterAiInsight[] => {
  const insights: ShooterAiInsight[] = [];
  if (results.length === 0) {
    return insights;
  }

  const enemyAggregates = new Map<string, { damage: number; appearances: number; destroyed: number }>();
  const tagCounts: Record<string, number> = {};
  results.forEach((result) => {
    result.enemyBreakdown.forEach((entry) => {
      const current = enemyAggregates.get(entry.enemyType) ?? { damage: 0, appearances: 0, destroyed: 0 };
      current.damage += entry.damageDealt;
      current.appearances += Math.max(1, entry.encounters || entry.destroyed + entry.survived);
      current.destroyed += entry.destroyed;
      enemyAggregates.set(entry.enemyType, current);
      Object.entries(entry.tags).forEach(([tag, count]) => {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + count;
      });
    });
    Object.entries(result.decisionTags).forEach(([tag, count]) => {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + count;
    });
  });

  enemyAggregates.forEach((aggregate, type) => {
    const avgDamage = aggregate.damage / Math.max(1, aggregate.appearances);
    const threatIndex = avgDamage * 1.8 + (aggregate.destroyed / Math.max(1, aggregate.appearances)) * 40;
    insights.push({
      focus: `Formation ${type}`,
      summary: `Ø Schaden ${avgDamage.toFixed(1)} · Eliminierungen ${aggregate.destroyed}/${aggregate.appearances}.`,
      threatIndex,
      dataPoints: aggregate.appearances,
    });
  });

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (sortedTags.length > 0) {
    const [tag, count] = sortedTags[0];
    insights.push({
      focus: `Dominante Taktik: ${tag}`,
      summary: `${count} registrierte Aktionen – verstärkt Feuerdisziplin aufrechterhalten.`,
      threatIndex: count * 5,
      dataPoints: count,
    });
  }

  return insights.sort((a, b) => b.threatIndex - a.threatIndex).slice(0, 6);
};

export const trainShooterModel = async (
  results: ShooterSimulationResult[],
  options: ShooterTrainingOptions = {}
): Promise<TrainedShooterModel> => {
  if (results.length === 0) {
    throw new Error('Keine Arcade-Shooter-Simulationen verfügbar.');
  }
  options.onProgress?.(0.1);
  const summary = summarizeShooterSimulations(results);
  if (!summary) {
    throw new Error('Konnte Arcade-Shooter-Zusammenfassung nicht berechnen.');
  }
  options.onProgress?.(0.45);
  const insights = buildShooterInsights(results);
  options.onProgress?.(0.85);
  const profile = summary.recommendedProfile ?? getDefaultShooterProfile();
  const model: TrainedShooterModel = {
    profile,
    summary,
    insights,
    describeProfile: () => profileDescription(profile),
    serialize: () => ({
      version: 1,
      generatedAt: new Date().toISOString(),
      profile,
      summary,
      insights,
    }),
  };
  options.onProgress?.(1);
  return model;
};

import type { ShooterTrainingSummary, TrainedShooterModel, SerializedShooterModel } from '../types';
import {
  getDefaultShooterProfile,
  profileDescription,
  setActiveShooterProfile,
  ShooterAiProfile,
} from '../../React-Retro-Arcade-Space-Shooter/game/enemyBrain';
import { loadStoredShooterModel, storeShooterModel } from './modelPersistence';

let trainedModel: TrainedShooterModel | null = null;

const sanitizeProfile = (profile: ShooterAiProfile): ShooterAiProfile => ({
  aggression: Math.max(0, Math.min(1.5, profile.aggression ?? 0.5)),
  accuracy: Math.max(0, Math.min(1, profile.accuracy ?? 0.5)),
  evasiveness: Math.max(0, Math.min(1, profile.evasiveness ?? 0.5)),
  coordination: Math.max(0, Math.min(1.2, profile.coordination ?? 0.5)),
  burstiness: Math.max(0, Math.min(1, profile.burstiness ?? 0.5)),
});

export const hydrateShooterModel = (serialized: SerializedShooterModel): TrainedShooterModel => {
  const normalizedProfile = sanitizeProfile(serialized.profile);
  const summary: ShooterTrainingSummary = serialized.summary
    ? {
        ...serialized.summary,
        recommendedProfile: sanitizeProfile(
          serialized.summary.recommendedProfile ?? normalizedProfile
        ),
        generatedAt:
          serialized.summary.generatedAt ?? serialized.generatedAt ?? new Date().toISOString(),
      }
    : {
        totalSimulations: 0,
        averageScore: 0,
        bestScore: 0,
        averageWaves: 0,
        averageLivesLost: 0,
        averageDamageToPlayer: 0,
        averageDamageToEnemies: 0,
        averageAccuracy: 0,
        recommendedDifficulty: 'normal',
        recommendedProfile: normalizedProfile,
        generatedAt: serialized.generatedAt ?? new Date().toISOString(),
      };
  return {
    profile: normalizedProfile,
    summary,
    insights: serialized.insights ?? [],
    describeProfile: () => profileDescription(normalizedProfile),
    serialize: () => ({
      version: serialized.version ?? 1,
      generatedAt: serialized.generatedAt ?? new Date().toISOString(),
      profile: normalizedProfile,
      summary: {
        ...summary,
        recommendedProfile: sanitizeProfile(summary.recommendedProfile ?? normalizedProfile),
      },
      insights: serialized.insights ?? [],
    }),
  };
};

const restoreTrainedShooterModel = () => {
  if (trainedModel) {
    return;
  }
  try {
    const stored = loadStoredShooterModel();
    if (stored) {
      trainedModel = hydrateShooterModel(stored);
      setActiveShooterProfile(trainedModel.profile);
      return;
    }
  } catch (error) {
    console.warn('Gespeichertes Arcade-Shooter-Modell konnte nicht geladen werden:', error);
  }
  setActiveShooterProfile(getDefaultShooterProfile());
};

if (typeof window !== 'undefined') {
  restoreTrainedShooterModel();
} else {
  setActiveShooterProfile(getDefaultShooterProfile());
}

export const setTrainedShooterModel = (model: TrainedShooterModel, options: { skipDownload?: boolean } = {}) => {
  trainedModel = model;
  setActiveShooterProfile(model.profile);
  try {
    storeShooterModel(model.serialize(), { triggerDownload: options.skipDownload !== true });
  } catch (error) {
    console.warn('Arcade-Shooter-Modell konnte nicht gespeichert werden:', error);
  }
};

export const getTrainedShooterModel = (): TrainedShooterModel | null => trainedModel;

export const isShooterAiTrained = (): boolean => trainedModel !== null;

export const importShooterModelFromFile = async (file: File): Promise<TrainedShooterModel> => {
  const content = await file.text();
  let parsed: SerializedShooterModel;
  try {
    parsed = JSON.parse(content) as SerializedShooterModel;
  } catch (error) {
    throw new Error('Die ausgewählte Datei enthält kein gültiges Arcade-Shooter-Modell.');
  }
  const model = hydrateShooterModel(parsed);
  setTrainedShooterModel(model, { skipDownload: true });
  return model;
};

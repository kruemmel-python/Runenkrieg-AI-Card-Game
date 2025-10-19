/// <reference lib="webworker" />

import { simulateShooterBattles, trainShooterModel } from '../services/shooterTrainingService';
import type {
  ShooterSimulationResult,
  SerializedShooterModel,
  ShooterDifficulty,
} from '../types';

type ShooterWorkerRequest =
  | {
      id: string;
      action: 'simulate';
      payload: {
        count: number;
        options: {
          difficulty: ShooterDifficulty;
          seed?: string;
        };
      };
    }
  | {
      id: string;
      action: 'train';
      payload: { simulations: ShooterSimulationResult[] };
    };

type ShooterWorkerResponse<Result> =
  | { id: string; action: ShooterWorkerRequest['action']; type: 'result'; result: Result }
  | { id: string; action: ShooterWorkerRequest['action']; type: 'progress'; progress: unknown }
  | { id: string; action: ShooterWorkerRequest['action']; type: 'error'; error: { message: string; stack?: string } };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

const postMessageSafe = <Result>(message: ShooterWorkerResponse<Result>) => {
  ctx.postMessage(message);
};

ctx.onmessage = async (event: MessageEvent<ShooterWorkerRequest>) => {
  const message = event.data;
  if (!message) {
    return;
  }

  const { id, action } = message;

  const forwardError = (error: unknown) => {
    const normalized =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };
    postMessageSafe({ id, action, type: 'error', error: normalized });
  };

  try {
    if (action === 'simulate') {
      const { count, options } = message.payload;
      const results = await simulateShooterBattles(count, {
        difficulty: options.difficulty,
        seed: options.seed,
        onProgress: (completed, total) => {
          postMessageSafe({ id, action, type: 'progress', progress: { completed, total } });
        },
      });
      postMessageSafe<ShooterSimulationResult[]>({ id, action, type: 'result', result: results });
      return;
    }

    if (action === 'train') {
      const { simulations } = message.payload;
      const model = await trainShooterModel(simulations, {
        onProgress: (progress) => {
          postMessageSafe({ id, action, type: 'progress', progress });
        },
      });
      const serialized: SerializedShooterModel = model.serialize();
      postMessageSafe({ id, action, type: 'result', result: serialized });
      return;
    }

    forwardError(new Error(`Unbekannte Aktion: ${action as string}`));
  } catch (error) {
    forwardError(error);
  }
};

/// <reference lib="webworker" />

import { simulateGames, trainModel } from '../services/trainingService';
import type {
  RoundResult,
  SerializedRunenkriegModel,
  TrainingProgressUpdate,
} from '../types';

type WorkerTrainingOptions = {
  preferGpu?: boolean;
  baseModel?: SerializedRunenkriegModel;
};

type RunenkriegWorkerRequest =
  | {
      id: string;
      action: 'simulate';
      payload: { count: number; options?: { chunkSize?: number; yieldDelayMs?: number } };
    }
  | {
      id: string;
      action: 'train';
      payload: { rounds: RoundResult[]; options?: WorkerTrainingOptions };
    };

type RunenkriegWorkerResponse<Result> =
  | { id: string; action: RunenkriegWorkerRequest['action']; type: 'result'; result: Result }
  | { id: string; action: RunenkriegWorkerRequest['action']; type: 'progress'; progress: unknown }
  | { id: string; action: RunenkriegWorkerRequest['action']; type: 'error'; error: { message: string; stack?: string } };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

const postMessageSafe = <Result>(message: RunenkriegWorkerResponse<Result>) => {
  ctx.postMessage(message);
};

ctx.onmessage = async (event: MessageEvent<RunenkriegWorkerRequest>) => {
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
      const results = await simulateGames(count, {
        chunkSize: options?.chunkSize,
        yieldDelayMs: options?.yieldDelayMs,
        onProgress: (completed, total) => {
          postMessageSafe({ id, action, type: 'progress', progress: { completed, total } });
        },
      });
      postMessageSafe<RoundResult[]>({ id, action, type: 'result', result: results });
      return;
    }

    if (action === 'train') {
      const { rounds, options } = message.payload;
      const model = await trainModel(rounds, {
        preferGpu: options?.preferGpu,
        baseModel: options?.baseModel,
        onProgress: (update: TrainingProgressUpdate) => {
          postMessageSafe({ id, action, type: 'progress', progress: update });
        },
      });
      const serialized: SerializedRunenkriegModel = model.serialize();
      postMessageSafe({ id, action, type: 'result', result: serialized });
      return;
    }

    forwardError(new Error(`Unbekannte Aktion: ${action as string}`));
  } catch (error) {
    forwardError(error);
  }
};

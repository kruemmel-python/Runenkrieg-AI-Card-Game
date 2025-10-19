/// <reference lib="webworker" />

import { simulateChessGames, trainChessModel } from '../services/chessTrainingService';
import type {
  ChessSimulationResult,
  SerializedChessModel,
  TrainingProgressUpdate,
} from '../types';

type WorkerTrainingOptions = {
  preferGpu?: boolean;
};

type ChessWorkerRequest =
  | {
      id: string;
      action: 'simulate';
      payload: { count: number; options?: { maxPlies?: number; randomness?: number } };
    }
  | {
      id: string;
      action: 'train';
      payload: { simulations: ChessSimulationResult[]; options?: WorkerTrainingOptions };
    };

type ChessWorkerResponse<Result> =
  | { id: string; action: ChessWorkerRequest['action']; type: 'result'; result: Result }
  | { id: string; action: ChessWorkerRequest['action']; type: 'progress'; progress: unknown }
  | { id: string; action: ChessWorkerRequest['action']; type: 'error'; error: { message: string; stack?: string } };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

const postMessageSafe = <Result>(message: ChessWorkerResponse<Result>) => {
  ctx.postMessage(message);
};

ctx.onmessage = async (event: MessageEvent<ChessWorkerRequest>) => {
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
      const results = await simulateChessGames(
        count,
        { maxPlies: options?.maxPlies, randomness: options?.randomness },
        (completed, total) => {
          postMessageSafe({ id, action, type: 'progress', progress: { completed, total } });
        }
      );
      postMessageSafe<ChessSimulationResult[]>({ id, action, type: 'result', result: results });
      return;
    }

    if (action === 'train') {
      const { simulations, options } = message.payload;
      const model = await trainChessModel(simulations, {
        preferGpu: options?.preferGpu,
        onProgress: (update: TrainingProgressUpdate) => {
          postMessageSafe({ id, action, type: 'progress', progress: update });
        },
      });
      const serialized: SerializedChessModel = model.serialize();
      postMessageSafe({ id, action, type: 'result', result: serialized });
      return;
    }

    forwardError(new Error(`Unbekannte Aktion: ${action as string}`));
  } catch (error) {
    forwardError(error);
  }
};

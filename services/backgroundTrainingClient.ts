import type {
  RoundResult,
  SerializedRunenkriegModel,
  TrainedModel,
  TrainingProgressUpdate,
  TrainingRunOptions,
} from '../types';
import {
  hydrateTrainedModel,
  simulateGames,
  trainModel,
} from './trainingService';

interface RunenkriegSimulationOptions {
  chunkSize?: number;
  yieldDelayMs?: number;
  onProgress?: (completed: number, total: number) => void;
}

interface RunenkriegTrainingOptions extends TrainingRunOptions {}

interface WorkerResultMessage<Result> {
  id: string;
  type: 'result';
  result: Result;
}

interface WorkerProgressMessage<Progress> {
  id: string;
  type: 'progress';
  progress: Progress;
}

interface WorkerErrorMessage {
  id: string;
  type: 'error';
  error: { message: string; stack?: string };
}

type WorkerMessage<Result, Progress> =
  | WorkerResultMessage<Result>
  | WorkerProgressMessage<Progress>
  | WorkerErrorMessage;

const RUNENKRIEG_WORKER_URL = new URL(
  '../workers/runenkriegWorker.ts',
  import.meta.url,
);

let workerIdCounter = 0;

const generateWorkerRequestId = (): string => {
  workerIdCounter += 1;
  return `runenkrieg-${Date.now()}-${workerIdCounter}`;
};

function runWorkerTask<Result, Progress>(
  action: 'simulate' | 'train',
  payload: unknown,
  onProgress?: (progress: Progress) => void,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    let worker: Worker;

    try {
      worker = new Worker(RUNENKRIEG_WORKER_URL, { type: 'module' });
    } catch (error) {
      reject(error);
      return;
    }

    const requestId = generateWorkerRequestId();
    let settled = false;

    const cleanup = (): void => {
      worker.terminate();
    };

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    worker.onmessage = (
      event: MessageEvent<WorkerMessage<Result, Progress>>,
    ): void => {
      const message = event.data;
      if (!message || message.id !== requestId) {
        return;
      }

      switch (message.type) {
        case 'progress':
          onProgress?.(message.progress);
          break;

        case 'result':
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(message.result);
          break;

        case 'error': {
          const error = new Error(
            message.error?.message ??
              'Unbekannter Fehler im Runenkrieg-Hintergrundprozess.',
          );
          if (message.error?.stack) {
            error.stack = message.error.stack;
          }
          fail(error);
          break;
        }
      }
    };

    worker.onerror = (event): void => {
      fail(new Error(event.message || 'Runenkrieg-Worker konnte nicht geladen werden.'));
    };

    worker.postMessage({ id: requestId, action, payload });
  });
}

const simulateDirectly = (
  count: number,
  options: RunenkriegSimulationOptions,
): Promise<RoundResult[]> =>
  simulateGames(count, {
    chunkSize: options.chunkSize,
    yieldDelayMs: options.yieldDelayMs,
    onProgress: options.onProgress,
  });

const trainDirectly = (
  rounds: RoundResult[],
  options: RunenkriegTrainingOptions,
): Promise<TrainedModel> =>
  trainModel(rounds, {
    preferGpu: options.preferGpu,
    baseModel: options.baseModel,
    onProgress: options.onProgress,
  });

export const runRunenkriegSimulation = async (
  count: number,
  options: RunenkriegSimulationOptions = {},
): Promise<RoundResult[]> => {
  if (typeof Worker === 'undefined') {
    return simulateDirectly(count, options);
  }

  try {
    return await runWorkerTask<
      RoundResult[],
      { completed: number; total: number }
    >(
      'simulate',
      {
        count,
        options: {
          chunkSize: options.chunkSize,
          yieldDelayMs: options.yieldDelayMs,
        },
      },
      (progress) => {
        options.onProgress?.(progress.completed, progress.total);
      },
    );
  } catch (error) {
    console.warn(
      'Runenkrieg-Worker nicht verfügbar; Simulation läuft im Hauptprozess weiter.',
      error,
    );
    return simulateDirectly(count, options);
  }
};

export const runRunenkriegTraining = async (
  rounds: RoundResult[],
  options: RunenkriegTrainingOptions = {},
): Promise<TrainedModel> => {
  if (typeof Worker === 'undefined') {
    return trainDirectly(rounds, options);
  }

  try {
    const serialized = await runWorkerTask<
      SerializedRunenkriegModel,
      TrainingProgressUpdate
    >(
      'train',
      {
        rounds,
        options: {
          preferGpu: options.preferGpu,
          baseModel: options.baseModel,
        },
      },
      (progress) => {
        options.onProgress?.(progress);
      },
    );

    return hydrateTrainedModel(serialized);
  } catch (error) {
    console.warn(
      'Runenkrieg-Worker nicht verfügbar; Training läuft im Hauptprozess weiter.',
      error,
    );
    return trainDirectly(rounds, options);
  }
};

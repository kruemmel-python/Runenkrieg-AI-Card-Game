import type {
  ChessSimulationResult,
  RoundResult,
  SerializedChessModel,
  SerializedRunenkriegModel,
  SerializedShooterModel,
  ShooterSimulationResult,
  ShooterDifficulty,
  TrainedModel,
  TrainingProgressUpdate,
  TrainingRunOptions,
  TrainedChessModel,
} from '../types';
import { hydrateTrainedModel } from './trainingService';
import { hydrateChessModel } from './chessTrainingService';
import { hydrateShooterModel } from './shooterAiService';

interface RunenkriegSimulationOptions {
  chunkSize?: number;
  yieldDelayMs?: number;
  onProgress?: (completed: number, total: number) => void;
}

interface RunenkriegTrainingOptions extends TrainingRunOptions {}

interface ChessSimulationOptions {
  maxPlies?: number;
  randomness?: number;
  onProgress?: (completed: number, total: number) => void;
}

interface ChessTrainingOptions extends TrainingRunOptions {}

interface ShooterSimulationOptions {
  difficulty: ShooterDifficulty;
  onProgress?: (completed: number, total: number) => void;
  seed?: string;
}

interface ShooterTrainingOptions {
  onProgress?: (progress: number) => void;
}

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

const RUNENKRIEG_WORKER_URL = new URL('../workers/runenkriegWorker.ts', import.meta.url);
const CHESS_WORKER_URL = new URL('../workers/chessWorker.ts', import.meta.url);
const SHOOTER_WORKER_URL = new URL('../workers/shooterWorker.ts', import.meta.url);

let workerIdCounter = 0;

const generateWorkerRequestId = () => {
  workerIdCounter += 1;
  return `task-${Date.now()}-${workerIdCounter}`;
};

function runWorkerTask<Result, Progress>(
  workerUrl: URL,
  action: string,
  payload: unknown,
  onProgress?: (progress: Progress) => void
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, { type: 'module' });
    const requestId = generateWorkerRequestId();

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<WorkerMessage<Result, Progress>>) => {
      const message = event.data;
      if (!message || message.id !== requestId) {
        return;
      }

      if (message.type === 'progress') {
        onProgress?.(message.progress);
        return;
      }

      if (message.type === 'result') {
        cleanup();
        resolve(message.result);
        return;
      }

      if (message.type === 'error') {
        cleanup();
        const error = new Error(message.error?.message ?? 'Unbekannter Fehler im Hintergrundprozess.');
        if (message.error?.stack) {
          error.stack = message.error.stack;
        }
        reject(error);
      }
    };

    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message ?? 'Worker-Fehler'));
    };

    worker.postMessage({ id: requestId, action, payload });
  });
}

export const runRunenkriegSimulation = async (
  count: number,
  options: RunenkriegSimulationOptions = {}
): Promise<RoundResult[]> => {
  const result = await runWorkerTask<RoundResult[], { completed: number; total: number }>(
    RUNENKRIEG_WORKER_URL,
    'simulate',
    { count, options: { chunkSize: options.chunkSize, yieldDelayMs: options.yieldDelayMs } },
    (progress) => {
      options.onProgress?.(progress.completed, progress.total);
    }
  );
  return result;
};

export const runRunenkriegTraining = async (
  rounds: RoundResult[],
  options: RunenkriegTrainingOptions = {}
): Promise<TrainedModel> => {
  const serialized = await runWorkerTask<SerializedRunenkriegModel, TrainingProgressUpdate>(
    RUNENKRIEG_WORKER_URL,
    'train',
    { rounds, options: { preferGpu: options.preferGpu, baseModel: options.baseModel } },
    (progress) => {
      options.onProgress?.(progress);
    }
  );

  return hydrateTrainedModel(serialized);
};

export const runChessSimulation = async (
  count: number,
  options: ChessSimulationOptions = {}
): Promise<ChessSimulationResult[]> => {
  const result = await runWorkerTask<ChessSimulationResult[], { completed: number; total: number }>(
    CHESS_WORKER_URL,
    'simulate',
    { count, options: { maxPlies: options.maxPlies, randomness: options.randomness } },
    (progress) => {
      options.onProgress?.(progress.completed, progress.total);
    }
  );

  return result;
};

export const runChessTraining = async (
  simulations: ChessSimulationResult[],
  options: ChessTrainingOptions = {}
): Promise<TrainedChessModel> => {
  const serialized = await runWorkerTask<SerializedChessModel, TrainingProgressUpdate>(
    CHESS_WORKER_URL,
    'train',
    { simulations, options: { preferGpu: options.preferGpu } },
    (progress) => {
      options.onProgress?.(progress);
    }
  );

  return hydrateChessModel(serialized);
};

export const runShooterSimulation = async (
  count: number,
  options: ShooterSimulationOptions
): Promise<ShooterSimulationResult[]> => {
  const { difficulty, seed } = options;
  const result = await runWorkerTask<ShooterSimulationResult[], { completed: number; total: number }>(
    SHOOTER_WORKER_URL,
    'simulate',
    { count, options: { difficulty, seed } },
    (progress) => {
      options.onProgress?.(progress.completed, progress.total);
    }
  );

  return result;
};

export const runShooterTraining = async (
  simulations: ShooterSimulationResult[],
  options: ShooterTrainingOptions = {}
) => {
  const serialized = await runWorkerTask<SerializedShooterModel, number>(
    SHOOTER_WORKER_URL,
    'train',
    { simulations },
    (progress) => {
      options.onProgress?.(progress);
    }
  );

  return hydrateShooterModel(serialized);
};

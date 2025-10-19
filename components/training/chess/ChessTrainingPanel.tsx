import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ChessAiInsight,
  ChessSimulationResult,
  ChessTrainingSummary,
} from '../../../types';
import {
  runChessSimulation,
  runChessTraining,
} from '../../../services/backgroundTrainingClient';
import {
  getTrainedChessModel,
  importChessModelFromFile,
  isChessAiTrained,
  setTrainedChessModel,
} from '../../../services/chessAiService';
import { summarizeChessSimulations } from '../../../services/chessTrainingService';
import Spinner from '../../Spinner';
import { formatNumber, formatPercent } from '../utils/formatting';

interface ChessTrainingContextValue {
  chessSimulationCount: number;
  setChessSimulationCount: (value: number) => void;
  chessSummary: ChessTrainingSummary | null;
  chessInsights: ChessAiInsight[];
  chessStatus: string;
  chessSimulationProgress: number;
  chessTrainingProgress: number;
  isChessSimulating: boolean;
  isChessTraining: boolean;
  handleChessSimulation: () => Promise<void>;
  handleChessTraining: () => Promise<void>;
  chessModelInputRef: React.RefObject<HTMLInputElement>;
  handleChessModelImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleChessModelUploadClick: () => void;
}

const ChessTrainingContext = createContext<ChessTrainingContextValue | undefined>(undefined);

const useChessTrainingController = (): ChessTrainingContextValue => {
  const [chessSimulationCount, setChessSimulationCount] = useState<number>(50);
  const [chessSimulations, setChessSimulations] = useState<ChessSimulationResult[]>([]);
  const [chessSummary, setChessSummary] = useState<ChessTrainingSummary | null>(
    getTrainedChessModel()?.summary ?? null
  );
  const [chessInsights, setChessInsights] = useState<ChessAiInsight[]>(
    getTrainedChessModel()?.insights.slice(0, 12) ?? []
  );
  const [isChessSimulating, setIsChessSimulating] = useState<boolean>(false);
  const [chessSimulationProgress, setChessSimulationProgress] = useState<number>(0);
  const [isChessTraining, setIsChessTraining] = useState<boolean>(false);
  const [chessTrainingProgress, setChessTrainingProgress] = useState<number>(0);
  const [chessStatus, setChessStatus] = useState<string>(
    isChessAiTrained()
      ? 'Schach-KI ist trainiert und aktiv.'
      : 'Schach-KI nutzt heuristische Eröffnungen.'
  );
  const chessModelInputRef = useRef<HTMLInputElement | null>(null);

  const handleChessSimulation = useCallback(async () => {
    setIsChessSimulating(true);
    setChessSimulationProgress(0);
    setChessTrainingProgress(0);
    setChessStatus('Starte Schach-Simulation im Hintergrund...');
    try {
      const results = await runChessSimulation(chessSimulationCount, {
        onProgress: (completed, total) => {
          const safeTotal = Math.max(1, total);
          setChessSimulationProgress(completed / safeTotal);
          setChessStatus(`Simuliere Schachpartien (${completed}/${total})...`);
        },
      });
      setChessSimulations(results);
      setChessSummary(summarizeChessSimulations(results));
      setChessStatus('Schach-Simulation abgeschlossen. Trainiere jetzt das Modell.');
    } catch (error) {
      console.error('Fehler bei der Schach-Simulation:', error);
      setChessStatus('Fehler bei der Schach-Simulation.');
      setChessSimulationProgress(0);
    } finally {
      setIsChessSimulating(false);
    }
  }, [chessSimulationCount]);

  const handleChessTraining = useCallback(async () => {
    if (chessSimulations.length === 0) {
      setChessStatus('Bitte führe zuerst Schach-Simulationen durch.');
      return;
    }
    setIsChessTraining(true);
    setChessTrainingProgress(0);
    setChessStatus('Initialisiere Schach-Training im Hintergrund...');
    try {
      const model = await runChessTraining(chessSimulations, {
        preferGpu: true,
        onProgress: (update) => {
          setChessTrainingProgress(Math.min(1, update.progress));
          setChessStatus(update.message);
        },
      });
      setTrainedChessModel(model);
      setChessSummary(model.summary);
      setChessInsights(model.insights.slice(0, 12));
      setChessTrainingProgress(1);
      setChessStatus('Schachtraining abgeschlossen. Modell gespeichert und aktiviert.');
    } catch (error) {
      console.error('Fehler beim Schach-Training:', error);
      setChessStatus('Fehler beim Training der Schach-KI.');
      setChessTrainingProgress(0);
    } finally {
      setIsChessTraining(false);
    }
  }, [chessSimulations]);

  const handleChessModelImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setChessStatus('Lade gespeichertes Schach-Modell...');
      setIsChessTraining(true);
      try {
        const model = await importChessModelFromFile(file);
        setChessSummary(model.summary);
        setChessInsights(model.insights.slice(0, 12));
        setChessTrainingProgress(1);
        setChessStatus('Gespeichertes Schach-Modell geladen und aktiviert.');
      } catch (error) {
        console.error('Fehler beim Laden des Schach-Modells:', error);
        setChessStatus('Gespeichertes Schach-Modell konnte nicht geladen werden.');
        setChessTrainingProgress(0);
      } finally {
        event.target.value = '';
        setIsChessTraining(false);
      }
    },
    []
  );

  const handleChessModelUploadClick = useCallback(() => {
    chessModelInputRef.current?.click();
  }, []);

  return {
    chessSimulationCount,
    setChessSimulationCount,
    chessSummary,
    chessInsights,
    chessStatus,
    chessSimulationProgress,
    chessTrainingProgress,
    isChessSimulating,
    isChessTraining,
    handleChessSimulation,
    handleChessTraining,
    chessModelInputRef,
    handleChessModelImport,
    handleChessModelUploadClick,
  };
};

export const ChessTrainingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useChessTrainingController();
  return <ChessTrainingContext.Provider value={value}>{children}</ChessTrainingContext.Provider>;
};

export const useChessTraining = (): ChessTrainingContextValue => {
  const context = useContext(ChessTrainingContext);
  if (!context) {
    throw new Error('useChessTraining must be used within a ChessTrainingProvider');
  }
  return context;
};

export const ChessTrainingPanel: React.FC<{ onSwitchView: (view: 'card' | 'training' | 'chess' | 'shooter') => void }> = ({
  onSwitchView,
}) => {
  const {
    chessSimulationCount,
    setChessSimulationCount,
    chessSummary,
    chessInsights,
    chessStatus,
    chessSimulationProgress,
    chessTrainingProgress,
    isChessSimulating,
    isChessTraining,
    handleChessSimulation,
    handleChessTraining,
    chessModelInputRef,
    handleChessModelImport,
    handleChessModelUploadClick,
  } = useChessTraining();

  const insights = useMemo(() => chessInsights.slice(0, 12), [chessInsights]);
  const summaryMetrics = useMemo(() => {
    if (!chessSummary) {
      return null;
    }

    const totalGames = chessSummary.totalGames;
    const averageMovesToWin = chessSummary.averagePlies / 2;
    const whiteWinRate = totalGames > 0 ? chessSummary.whiteWins / totalGames : null;
    const blackWinRate = totalGames > 0 ? chessSummary.blackWins / totalGames : null;
    const drawRate = totalGames > 0 ? chessSummary.draws / totalGames : null;
    const topOpening = chessSummary.topOpenings?.[0] ?? null;
    const topOpeningShare =
      topOpening && totalGames > 0 ? topOpening.count / totalGames : null;

    return {
      totalGames,
      averageMovesToWin,
      whiteWinRate,
      blackWinRate,
      drawRate,
      decisiveRate: chessSummary.decisiveRate,
      topOpening,
      topOpeningShare,
      entropyWhite: chessSummary.entropyWhite,
      entropyBlack: chessSummary.entropyBlack,
      entropyDelta: chessSummary.entropyDelta,
      resonance: chessSummary.resonanceMapping ?? [],
      learningBalance: chessSummary.learningBalance ?? [],
    };
  }, [chessSummary]);

  return (
    <section className="w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl p-8 border border-slate-700">
      <h2 className="text-3xl font-bold text-center mb-2 text-emerald-400">Schach-Trainingsarena</h2>
      <p className="text-center text-slate-400 mb-6">
        Trainiere komplexe Schachpositionen und verbessere die taktischen Reaktionen der KI.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-lg">
          <h3 className="text-2xl font-bold mb-4 text-slate-100">Simulation</h3>
          <div className="mb-4">
            <label htmlFor="chess-sim-count" className="block mb-2 font-medium">
              Anzahl der Simulationen
            </label>
            <input
              type="number"
              id="chess-sim-count"
              value={chessSimulationCount}
              onChange={(event) => setChessSimulationCount(parseInt(event.target.value, 10))}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:ring-2 focus:ring-emerald-500"
              min={10}
              step={10}
            />
          </div>
          <button
            onClick={handleChessSimulation}
            disabled={isChessSimulating}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-500 flex items-center justify-center"
          >
            {isChessSimulating && <Spinner />}
            {isChessSimulating ? 'Simuliere...' : `Simuliere ${chessSimulationCount} Partien`}
          </button>
          {(isChessSimulating || chessSimulationProgress > 0) && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Fortschritt</span>
                <span>{Math.round(chessSimulationProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, chessSimulationProgress * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800 p-6 rounded-lg">
          <h3 className="text-2xl font-bold mb-4 text-slate-100">Training</h3>
          <button
            onClick={handleChessTraining}
            disabled={isChessTraining}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-500 flex items-center justify-center"
          >
            {isChessTraining && <Spinner />}
            {isChessTraining ? 'Trainiere...' : 'Training starten'}
          </button>
          {(isChessTraining || chessTrainingProgress > 0) && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Fortschritt</span>
                <span>{Math.round(chessTrainingProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, chessTrainingProgress * 100))}%` }}
                />
              </div>
            </div>
          )}
          <button
            onClick={handleChessModelUploadClick}
            disabled={isChessTraining}
            className="mt-4 w-full border border-slate-500 text-slate-200 hover:bg-slate-800 rounded-md py-2"
          >
            Gespeichertes Modell importieren
          </button>
          <input
            type="file"
            accept="application/json"
            ref={chessModelInputRef}
            onChange={handleChessModelImport}
            className="hidden"
          />
        </div>
      </div>

      <p className="mt-4 text-center text-slate-300">{chessStatus}</p>

      {summaryMetrics && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h4 className="text-lg font-semibold text-slate-100">Simulationsergebnisse</h4>
            <p className="text-sm text-slate-300 mt-2">
              Gesamte Partien {formatNumber(summaryMetrics.totalGames)} · Weiß-Siegquote{' '}
              {formatPercent(summaryMetrics.whiteWinRate)}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Schwarz-Siegquote {formatPercent(summaryMetrics.blackWinRate)} · Remisrate{' '}
              {formatPercent(summaryMetrics.drawRate)}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Ø Züge bis zum Partieende: {formatNumber(Math.round(summaryMetrics.averageMovesToWin))}
            </p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h4 className="text-lg font-semibold text-slate-100">Eröffnungsfokus</h4>
            <p className="text-sm text-slate-300 mt-2">
              Favorisierte Variante:{' '}
              <span className="text-emerald-300">
                {summaryMetrics.topOpening?.sequence?.length ? summaryMetrics.topOpening.sequence : '–'}
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Anteil an allen Partien {formatPercent(summaryMetrics.topOpeningShare)} · Erfolgsquote{' '}
              {formatPercent(summaryMetrics.topOpening?.winRate)}
            </p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <h4 className="text-lg font-semibold text-slate-100">Verteidigungsprofil</h4>
            <p className="text-sm text-slate-300 mt-2">
              Entscheidungsrate: {formatPercent(summaryMetrics.decisiveRate)}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Entropie Weiß {summaryMetrics.entropyWhite.toFixed(2)} · Entropie Schwarz{' '}
              {summaryMetrics.entropyBlack.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Δ Entropie: {formatSigned(summaryMetrics.entropyDelta, 2)}
            </p>
          </div>
        </div>
      )}

      {summaryMetrics?.resonance.length ? (
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-white mb-4">Runen-Resonanzen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaryMetrics.resonance.map((resonance) => (
              <div key={resonance.rune} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-slate-100">{resonance.rune}</h4>
                  <span className="text-xs text-emerald-300">{formatPercent(resonance.intensity)}</span>
                </div>
                <p className="text-sm text-slate-300 mt-2">{resonance.chessPattern}</p>
                <p className="text-xs text-slate-400 mt-3">{resonance.commentary}</p>
                <p className="text-xs text-slate-500 mt-3">
                  Dominant:{' '}
                  {resonance.dominantColor === 'balanced'
                    ? 'ausgeglichen'
                    : resonance.dominantColor === 'white'
                    ? 'Weiß'
                    : 'Schwarz'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summaryMetrics?.learningBalance.length ? (
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-white mb-4">Trainingsbalance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaryMetrics.learningBalance.map((item) => (
              <div
                key={`${item.runeMechanic}-${item.chessConcept}`}
                className="bg-slate-800 p-4 rounded-lg border border-slate-700"
              >
                <h4 className="text-lg font-semibold text-slate-100">
                  {item.runeMechanic} ↔ {item.chessConcept}
                </h4>
                <p className="text-xs text-slate-400 mt-2">
                  Weiß: {formatPercent(item.whiteScore)} · Schwarz: {formatPercent(item.blackScore)}
                </p>
                <p className="text-xs text-slate-400 mt-2">Balance: {formatSigned(item.balance, 2)}</p>
                <p className="text-xs text-slate-500 mt-3">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {insights.length > 0 && (
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-white mb-4">KI-Einblicke</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => (
              <div
                key={`${insight.fen}-${insight.recommendedMove}-${index}`}
                className="bg-slate-800 p-4 rounded-lg border border-slate-700"
              >
                <h4 className="text-lg font-semibold text-slate-100">
                  Empfohlener Zug {insight.recommendedMove.toUpperCase()}
                </h4>
                <p className="text-sm text-slate-300 mt-2 break-words">
                  Stellung (FEN): <span className="text-slate-200">{insight.fen}</span>
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Erwarteter Score {formatPercent(insight.expectedScore)} · Vertrauen{' '}
                  {formatPercent(insight.confidence)} · Stichproben {formatNumber(insight.sampleSize)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => onSwitchView('card')}
          className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Zurück zum Kartenspiel
        </button>
        <button
          onClick={() => onSwitchView('shooter')}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Zum Arcade-Shooter
        </button>
      </div>
    </section>
  );
};

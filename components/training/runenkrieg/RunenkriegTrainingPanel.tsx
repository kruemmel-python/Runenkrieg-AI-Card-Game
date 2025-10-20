import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ContextInsight,
  RoundResult,
  SimulationAnalysis,
  TrainingAnalysis,
} from '../../../types';
import {
  runRunenkriegSimulation,
  runRunenkriegTraining,
} from '../../../services/backgroundTrainingClient';
import {
  getTrainedModel,
  importRunenkriegModelFromFile,
  isAiTrained,
  setTrainedModel,
} from '../../../services/aiService';
import CardGenerator from '../../CardGenerator';
import Spinner from '../../Spinner';
import { buildSimulationAnalysis } from '../utils/analysis';
import {
  buildContextBadges,
  describeTokenAdvantage,
  formatEvidence,
  formatInterval,
  formatNumber,
  formatPercent,
  formatSigned,
  formatTokenDelta,
} from '../utils/formatting';
import {
  BanditPolicySummary,
  readBanditPolicySummary,
} from '../../../services/runenkrieg/banditStorage';

export type SimulationStatusTone = 'idle' | 'progress' | 'success' | 'error';

export const STATUS_TONE_CLASS: Record<SimulationStatusTone, string> = {
  idle: 'text-slate-400',
  progress: 'text-slate-300',
  success: 'text-green-400',
  error: 'text-red-400',
};

interface RunenkriegTrainingContextValue {
  aiStatus: string;
  simulationCount: number;
  setSimulationCount: (value: number) => void;
  simulationAnalysis: SimulationAnalysis | null;
  trainingAnalysis: TrainingAnalysis | null;
  isSimulating: boolean;
  simulationProgress: number;
  simulationStatus: string;
  simulationStatusTone: SimulationStatusTone;
  handleSimulate: () => Promise<void>;
  trainingStatus: string;
  trainingProgress: number;
  isTraining: boolean;
  handleTraining: () => Promise<void>;
  focusWeather: 'all' | 'regenWind';
  setFocusWeather: (value: 'all' | 'regenWind') => void;
  onlyHighTokenDelta: boolean;
  setOnlyHighTokenDelta: (value: boolean) => void;
  onlyDragonDuels: boolean;
  setOnlyDragonDuels: (value: boolean) => void;
  runenkriegModelInputRef: React.RefObject<HTMLInputElement>;
  handleModelImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleModelUploadClick: () => void;
  banditSummary: BanditPolicySummary;
  refreshBanditSummary: () => void;
}

const RunenkriegTrainingContext = createContext<RunenkriegTrainingContextValue | undefined>(
  undefined
);

const useRunenkriegTrainingController = (): RunenkriegTrainingContextValue => {
  const [simulationCount, setSimulationCount] = useState<number>(1000);
  const [simulationData, setSimulationData] = useState<RoundResult[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationStatus, setSimulationStatus] = useState<string>('Bereit für Simulationen.');
  const [simulationStatusTone, setSimulationStatusTone] = useState<SimulationStatusTone>('idle');
  const [simulationAnalysis, setSimulationAnalysis] = useState<SimulationAnalysis | null>(null);

  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingStatus, setTrainingStatus] = useState<string>('Bereit für Training.');
  const [trainingProgress, setTrainingProgress] = useState<number>(0);
  const [trainingAnalysis, setTrainingAnalysis] = useState<TrainingAnalysis | null>(
    getTrainedModel()?.analysis ?? null
  );
  const [aiStatus, setAiStatus] = useState<string>(
    isAiTrained() ? 'KI ist trainiert und aktiv.' : 'KI nutzt zufällige Züge.'
  );
  const [banditSummary, setBanditSummary] = useState<BanditPolicySummary>(readBanditPolicySummary);
  const [onlyHighTokenDelta, setOnlyHighTokenDelta] = useState<boolean>(false);
  const [focusWeather, setFocusWeather] = useState<'all' | 'regenWind'>('all');
  const [onlyDragonDuels, setOnlyDragonDuels] = useState<boolean>(false);
  const runenkriegModelInputRef = useRef<HTMLInputElement | null>(null);

  const refreshBanditSummary = useCallback(() => {
    setBanditSummary(readBanditPolicySummary());
  }, []);

  useEffect(() => {
    refreshBanditSummary();
  }, [refreshBanditSummary]);

  const handleSimulate = useCallback(async () => {
    setIsSimulating(true);
    setSimulationStatus('Initialisiere Hintergrundsimulation...');
    setSimulationStatusTone('progress');
    setSimulationProgress(0);
    try {
      const results = await runRunenkriegSimulation(simulationCount, {
        onProgress: (completed, total) => {
          const value = total > 0 ? completed / total : 0;
          setSimulationProgress(value);
          setSimulationStatus(`Simuliere Runenkrieg-Runden (${completed}/${total})...`);
        },
      });
      setSimulationData(results);
      const analysis = buildSimulationAnalysis(results);
      setSimulationAnalysis(analysis);
      setSimulationStatus('Simulation abgeschlossen.');
      setSimulationStatusTone('success');
    } catch (error) {
      console.error('Fehler bei der Runenkrieg-Simulation:', error);
      setSimulationStatus('Fehler bei der Runenkrieg-Simulation.');
      setSimulationStatusTone('error');
      setSimulationProgress(0);
    } finally {
      setIsSimulating(false);
    }
  }, [simulationCount]);

  const handleTraining = useCallback(async () => {
    if (simulationData.length === 0) {
      setTrainingStatus('Bitte führe zuerst Simulationen durch.');
      setTrainingProgress(0);
      setTrainingStatus('Bereit für Training.');
      return;
    }
    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingStatus('Initialisiere Hintergrund-Training...');
    try {
      const currentModel = getTrainedModel();
      const model = await runRunenkriegTraining(simulationData, {
        preferGpu: true,
        baseModel: currentModel ? currentModel.serialize() : undefined,
        onProgress: (update) => {
          setTrainingProgress(Math.min(1, update.progress));
          setTrainingStatus(update.message);
        },
      });
      setTrainedModel(model);
      setTrainingAnalysis(model.analysis);
      setAiStatus('KI wurde mit neuen Daten trainiert und ist aktiv.');
      setTrainingProgress(1);
      setTrainingStatus('Training abgeschlossen. Modell gespeichert und aktiviert.');
    } catch (error) {
      console.error('Fehler beim KI-Training:', error);
      setTrainingStatus('Fehler beim Training der KI.');
      setTrainingProgress(0);
    } finally {
      setIsTraining(false);
    }
  }, [simulationData]);

  const handleModelImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setTrainingStatus('Lade gespeichertes Runenkrieg-Modell...');
      setIsTraining(true);
      try {
        const model = await importRunenkriegModelFromFile(file);
        setTrainingAnalysis(model.analysis);
        setAiStatus('Gespeichertes Runenkrieg-Modell geladen und aktiviert.');
        setTrainingProgress(1);
        setTrainingStatus('Modell importiert und aktiviert.');
      } catch (error) {
        console.error('Fehler beim Laden des Runenkrieg-Modells:', error);
        setTrainingStatus('Gespeichertes Runenkrieg-Modell konnte nicht geladen werden.');
        setTrainingProgress(0);
      } finally {
        event.target.value = '';
        setIsTraining(false);
      }
    },
    []
  );

  const handleModelUploadClick = useCallback(() => {
    runenkriegModelInputRef.current?.click();
  }, []);

  return {
    aiStatus,
    simulationCount,
    setSimulationCount,
    simulationAnalysis,
    trainingAnalysis,
    isSimulating,
    simulationProgress,
    simulationStatus,
    simulationStatusTone,
    handleSimulate,
    trainingStatus,
    trainingProgress,
    isTraining,
    handleTraining,
    focusWeather,
    setFocusWeather,
    onlyHighTokenDelta,
    setOnlyHighTokenDelta,
    onlyDragonDuels,
    setOnlyDragonDuels,
    runenkriegModelInputRef,
    handleModelImport,
    handleModelUploadClick,
    banditSummary,
    refreshBanditSummary,
  };
};

export const RunenkriegTrainingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = useRunenkriegTrainingController();
  return (
    <RunenkriegTrainingContext.Provider value={value}>
      {children}
    </RunenkriegTrainingContext.Provider>
  );
};

export const useRunenkriegTraining = (): RunenkriegTrainingContextValue => {
  const context = useContext(RunenkriegTrainingContext);
  if (!context) {
    throw new Error('useRunenkriegTraining must be used within a RunenkriegTrainingProvider');
  }
  return context;
};

const matchesContextFilters = (
  context: ContextInsight,
  filters: {
    onlyHighTokenDelta: boolean;
    focusWeather: 'all' | 'regenWind';
    onlyDragonDuels: boolean;
  }
) => {
  if (filters.onlyHighTokenDelta && context.tokenDelta < 3) {
    return false;
  }
  if (
    filters.focusWeather === 'regenWind' &&
    context.weather !== 'Regen' &&
    context.weather !== 'Windsturm'
  ) {
    return false;
  }
  if (
    filters.onlyDragonDuels &&
    !(context.playerHero.includes('Drache') && context.aiHero.includes('Drache'))
  ) {
    return false;
  }
  return true;
};

const renderContextList = (
  title: string,
  contexts: TrainingAnalysis['topContexts'],
  filters: {
    onlyHighTokenDelta: boolean;
    focusWeather: 'all' | 'regenWind';
    onlyDragonDuels: boolean;
  },
  emptyMessage?: string
) => {
  const filteredContexts = (contexts ?? []).filter((context) =>
    matchesContextFilters(context, filters)
  );

  if (!filteredContexts || filteredContexts.length === 0) {
    return emptyMessage ? (
      <div className="mt-6">
        <h4 className="text-xl font-semibold text-white mb-3">{title}</h4>
        <p className="text-slate-400 text-sm">{emptyMessage}</p>
      </div>
    ) : null;
  }

  return (
    <div className="mt-6">
      <h4 className="text-xl font-semibold text-white mb-3">{title}</h4>
      <ul className="space-y-3">
        {filteredContexts.map((context, index) => (
          <li
            key={`${title}-${context.playerCard}-${context.aiCard}-${index}`}
            className="bg-slate-900 p-4 rounded-lg border border-slate-700"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">#{index + 1}</p>
            <p>
              Spielerkarte <span className="text-purple-300">{context.playerCard}</span> bei
              Wetter <span className="text-purple-300">{context.weather}</span> wird am besten
              mit <span className="text-purple-300">{context.aiCard}</span> beantwortet.
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Helden-Duell <span className="text-purple-300">{context.playerHero}</span> vs.{` `}
              <span className="text-purple-300">{context.aiHero}</span> bei einer Token-Differenz
              von <span className="text-purple-300">{formatTokenDelta(context.tokenDelta)}</span>{' '}
              {describeTokenAdvantage(context.tokenDelta)}.
            </p>
            <p className="mt-1 text-sm">
              <span
                className="text-green-400"
                title={`Quote: ${formatPercent(context.winRate)} | N=${formatNumber(
                  context.observations
                )} | Wilson: ${formatInterval(context.wilsonLower, context.wilsonUpper)} | Evidenz: ${formatEvidence(
                  context.evidenceScore
                )}`}
              >
                Siegquote: {formatPercent(context.winRate)}
              </span>{' '}
              <span className="text-slate-400">(Baseline {formatPercent(context.baselineWinRate)} ·
                Lift {formatSigned(context.lift)})</span>
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {buildContextBadges(context).map((badge) => (
                <span
                  key={`${context.playerCard}-${badge.label}`}
                  className={`${badge.color} text-white text-xs font-semibold px-2 py-1 rounded-full`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const renderFusionInsights = (analysis: TrainingAnalysis | null) => {
  const insights = analysis?.fusionInsights ?? [];
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h4 className="text-xl font-semibold text-white mb-3">Fusionsempfehlungen</h4>
      <ul className="space-y-3">
        {insights.slice(0, 6).map((entry, index) => (
          <li
            key={`${entry.contextKey}-${index}`}
            className="bg-slate-900 p-4 rounded-lg border border-indigo-700"
          >
            <p className="text-xs uppercase tracking-wide text-indigo-400 mb-1">#{index + 1}</p>
            <p className="text-sm text-slate-200">
              {entry.actor === 'spieler' ? 'Spieler' : 'KI'} fusioniert bei{' '}
              <span className="text-purple-300">{entry.weather}</span> und ΔToken{' '}
              <span className="text-purple-300">{formatTokenDelta(entry.tokenDelta)}</span> bevorzugt zu{' '}
              <span className="text-purple-300">{entry.fusedCard}</span>.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Erfolgsquote {formatPercent(entry.fusionRate)} · Ø Gewinn {formatSigned(entry.averageGain)} ·
              Beobachtungen {formatNumber(entry.observations)} · Empfehlung{' '}
              <span className="text-indigo-300 font-semibold">{entry.recommendation === 'fuse' ? 'fusionieren' : 'halten'}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const RunenkriegTrainingPanel: React.FC<{ onSwitchView: (view: 'card' | 'training' | 'chess' | 'shooter') => void }> = ({
  onSwitchView,
}) => {
  const {
    aiStatus,
    simulationCount,
    setSimulationCount,
    simulationAnalysis,
    trainingAnalysis,
    isSimulating,
    simulationProgress,
    simulationStatus,
    simulationStatusTone,
    handleSimulate,
    trainingStatus,
    trainingProgress,
    isTraining,
    handleTraining,
    focusWeather,
    setFocusWeather,
    onlyHighTokenDelta,
    setOnlyHighTokenDelta,
    onlyDragonDuels,
    setOnlyDragonDuels,
    runenkriegModelInputRef,
    handleModelImport,
    handleModelUploadClick,
    banditSummary,
    refreshBanditSummary,
  } = useRunenkriegTraining();

  const filters = useMemo(
    () => ({ onlyHighTokenDelta, focusWeather, onlyDragonDuels }),
    [onlyHighTokenDelta, focusWeather, onlyDragonDuels]
  );

  return (
    <section className="w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl p-8 border border-slate-700">
      <h1 className="text-4xl font-bold text-center mb-2 text-purple-400">KI Trainingszentrum</h1>
      <p className="text-center text-slate-400 mb-8">
        Hier kannst du die KI trainieren, um bessere Entscheidungen zu treffen.
      </p>

      <CardGenerator />

      <div className="mb-6 p-4 bg-slate-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-2 text-cyan-300">Aktueller KI-Status</h2>
        <p className="text-slate-300 mb-3">{aiStatus}</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-400">
          <div>
            <span className="text-indigo-300 font-semibold">{formatNumber(banditSummary.contextCount)}</span>{' '}
            Lernkontexte ·{' '}
            <span className="text-green-300 font-semibold">{formatNumber(banditSummary.fuseDecisions)}</span>{' '}
            Fusionen ·{' '}
            <span className="text-orange-300 font-semibold">{formatNumber(banditSummary.skipDecisions)}</span>{' '}
            Aussetzer
          </div>
          <button
            type="button"
            onClick={refreshBanditSummary}
            className="self-start md:self-auto px-3 py-1.5 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Bandit-Status aktualisieren
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-lg">
          <h3 className="text-2xl font-bold mb-4">Schritt 1: Simulation</h3>
          <p className="mb-4 text-slate-400">
            Generiere Spieldaten, indem du eine große Anzahl von Spielen simulierst.
          </p>
          <div className="mb-4">
            <label htmlFor="sim-count" className="block mb-2 font-medium">
              Anzahl der Simulationen
            </label>
            <input
              type="number"
              id="sim-count"
              value={simulationCount}
              onChange={(event) => setSimulationCount(parseInt(event.target.value, 10))}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:ring-2 focus:ring-purple-500"
              min={100}
              step={100}
            />
          </div>
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-500 flex items-center justify-center"
          >
            {isSimulating && <Spinner />}
            {isSimulating ? 'Simuliere...' : `Simuliere ${simulationCount} Spiele`}
          </button>
          {isSimulating && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Fortschritt</span>
                <span>{Math.round(simulationProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, simulationProgress * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-slate-300 text-sm text-center">{simulationStatus}</p>
            </div>
          )}
          {!isSimulating && simulationStatus && (
            <p className={`mt-4 text-center ${STATUS_TONE_CLASS[simulationStatusTone]}`}>
              {simulationStatus}
            </p>
          )}
        </div>

        <div className="bg-slate-800 p-6 rounded-lg">
          <h3 className="text-2xl font-bold mb-4">Schritt 2: Training</h3>
          <p className="mb-4 text-slate-400">
            Nutze die simulierten Daten, um ein Entscheidungsmodell für die KI zu erstellen.
          </p>
          <button
            onClick={handleTraining}
            disabled={isTraining}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-500 flex items-center justify-center"
          >
            {isTraining && <Spinner />}
            {isTraining ? 'Trainiere...' : 'Training starten'}
          </button>
          {(isTraining || trainingProgress > 0) && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Fortschritt</span>
                <span>{Math.round(trainingProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, trainingProgress * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-slate-300 text-sm text-center">{trainingStatus}</p>
            </div>
          )}
          <button
            onClick={handleModelUploadClick}
            disabled={isTraining}
            className="mt-4 w-full border border-slate-500 text-slate-200 hover:bg-slate-800 rounded-md py-2"
          >
            Gespeichertes Modell importieren
          </button>
          <input
            type="file"
            accept="application/json"
            className="hidden"
            ref={runenkriegModelInputRef}
            onChange={handleModelImport}
          />
        </div>
      </div>

      {simulationAnalysis && (
        <div className="mt-10">
          <h3 className="text-2xl font-bold text-white mb-4">Simulationsergebnisse</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h4 className="text-lg font-semibold text-slate-100 mb-2">Übersicht</h4>
              <p className="text-sm text-slate-300">
                Spieler Siege: <span className="text-green-400">{simulationAnalysis.playerWins}</span> · KI Siege:{' '}
                <span className="text-indigo-300">{simulationAnalysis.aiWins}</span> · Unentschieden:{' '}
                <span className="text-slate-200">{simulationAnalysis.draws}</span>
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Spieler Winrate {formatPercent(simulationAnalysis.playerWinRate)} · KI Winrate{' '}
                {formatPercent(simulationAnalysis.aiWinRate)}
              </p>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h4 className="text-lg font-semibold text-slate-100 mb-2">Beliebteste Kombinationen</h4>
              <p className="text-sm text-slate-300">
                Spielerkarte <span className="text-purple-300">{simulationAnalysis.mostCommonPlayerCard}</span> · KI-Karte{' '}
                <span className="text-purple-300">{simulationAnalysis.mostCommonAiCard}</span>
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Häufigstes Wetter <span className="text-indigo-300">{simulationAnalysis.mostCommonWeather}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {trainingAnalysis && (
        <div className="mt-10">
          <h3 className="text-2xl font-bold text-white mb-4">Trainingsanalyse</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300">
                Kontexte gesamt <span className="text-purple-300">{formatNumber(trainingAnalysis.totalContexts)}</span>
              </p>
              <p className="text-sm text-slate-300">
                Solide Daten <span className="text-green-400">{formatNumber(trainingAnalysis.contextsWithSolidData)}</span>
              </p>
              <p className="text-sm text-slate-300">
                Kritische Kontexte{' '}
                <span className="text-amber-400">{formatNumber(trainingAnalysis.contextsNeedingData)}</span>
              </p>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300">
                Durchschnitt beste Winrate{' '}
                <span className="text-indigo-300">
                  {formatPercent(trainingAnalysis.averageBestWinRate)}
                </span>
              </p>
              {trainingAnalysis.bestContext && (
                <p className="text-xs text-slate-400 mt-2">
                  Bester Konter gegen{' '}
                  <span className="text-purple-300">{trainingAnalysis.bestContext.playerCard}</span>:{' '}
                  <span className="text-green-300">{trainingAnalysis.bestContext.aiCard}</span>{' '}
                  ({formatPercent(trainingAnalysis.bestContext.winRate)} · ΔToken{' '}
                  {formatTokenDelta(trainingAnalysis.bestContext.tokenDelta)} ·{' '}
                  {describeTokenAdvantage(trainingAnalysis.bestContext.tokenDelta)}).
                </p>
              )}
            </div>
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300">
                Top-Resampling-Fokus:{' '}
                <span className="text-purple-300">
                  {trainingAnalysis.resamplingPlan?.[0]?.playerCard ?? '–'}
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Empfehlung: {trainingAnalysis.resamplingPlan?.[0]?.reason ?? 'keine spezifische Empfehlung'}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-xl font-semibold text-white mb-3">Kontext-Filter</h4>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyHighTokenDelta}
                  onChange={(event) => setOnlyHighTokenDelta(event.target.checked)}
                />
                Nur hohe Token-Deltas hervorheben
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyDragonDuels}
                  onChange={(event) => setOnlyDragonDuels(event.target.checked)}
                />
                Nur Drachen-Duelle anzeigen
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                Fokus auf{' '}
                <select
                  value={focusWeather}
                  onChange={(event) => setFocusWeather(event.target.value as 'all' | 'regenWind')}
                  className="bg-slate-800 border border-slate-600 rounded-md px-2 py-1"
                >
                  <option value="all">Alle Wetterlagen</option>
                  <option value="regenWind">Nur Regen &amp; Windsturm</option>
                </select>
              </label>
            </div>
          </div>

          {renderContextList(
            'Top-Kontexte für KI-Gegenstrategien',
            trainingAnalysis.topContexts,
            filters,
            'Noch keine verlässlichen Top-Kontexte identifiziert.'
          )}
          {renderContextList(
            'Kontexte mit Trainingsbedarf',
            trainingAnalysis.strugglingContexts,
            filters,
            'Alle Problemkontexte wurden adressiert – weiter so!'
          )}
          {renderContextList(
            'Datenlücken mit hoher Priorität',
            trainingAnalysis.dataGaps,
            filters,
            'Keine offenen Datenlücken.'
          )}

          {renderFusionInsights(trainingAnalysis)}

          <div className="mt-6">
            <h4 className="text-xl font-semibold text-white mb-3">Token-Delta-Abdeckung</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-2 pr-4">Δ Token</th>
                    <th className="py-2 pr-4">Kontexte</th>
                    <th className="py-2 pr-4">Solide Daten</th>
                    <th className="py-2 pr-4">Ø Winrate</th>
                    <th className="py-2 pr-4">Ø Baseline</th>
                    <th className="py-2 pr-4">Ø Lift</th>
                    <th className="py-2 pr-4">Ø Beobachtungen</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingAnalysis.coverageByTokenDelta?.map((entry) => (
                    <tr key={entry.tokenDelta} className="border-t border-slate-800 text-slate-200">
                      <td className="py-2 pr-4">{formatTokenDelta(entry.tokenDelta)}</td>
                      <td className="py-2 pr-4">{formatNumber(entry.contextCount)}</td>
                      <td className="py-2 pr-4">{formatNumber(entry.solidDataContexts)}</td>
                      <td className="py-2 pr-4">{formatPercent(entry.averageWinRate)}</td>
                      <td className="py-2 pr-4">{formatPercent(entry.averageBaseline)}</td>
                      <td className="py-2 pr-4">{formatSigned(entry.averageLift)}</td>
                      <td className="py-2 pr-4">{formatNumber(entry.averageObservations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-xl font-semibold text-white mb-3">Mechanik-Performance</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-2 pr-4">Mechanik</th>
                    <th className="py-2 pr-4">Winrate</th>
                    <th className="py-2 pr-4">Beobachtungen</th>
                    <th className="py-2 pr-4">Normalisierter Lift</th>
                    <th className="py-2 pr-4">Kontexte</th>
                    <th className="py-2 pr-4">Ø Δ Token</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingAnalysis.mechanicEffectiveness?.map((entry) => (
                    <tr key={entry.mechanic} className="border-t border-slate-800 text-slate-200">
                      <td className="py-2 pr-4">{entry.mechanic}</td>
                      <td className="py-2 pr-4">{formatPercent(entry.winRate)}</td>
                      <td className="py-2 pr-4">{formatNumber(entry.observations)}</td>
                      <td className="py-2 pr-4">{formatSigned(entry.normalizedLift)}</td>
                      <td className="py-2 pr-4">{formatNumber(entry.contexts)}</td>
                      <td className="py-2 pr-4">{formatSigned(entry.averageTokenDelta, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-xl font-semibold text-white mb-3">Strategische Hinweise</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trainingAnalysis.heroMatchupInsights?.map((entry) => (
                <div key={`${entry.playerHero}-${entry.aiHero}`} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <h5 className="text-lg font-semibold text-slate-100">
                    {entry.playerHero} vs. {entry.aiHero}
                  </h5>
                  <p className="text-sm text-slate-300">
                    Kontexte {formatNumber(entry.contexts)} · Beobachtungen{' '}
                    {formatNumber(entry.observations)}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Durchschnittliche beste Winrate {formatPercent(entry.averageBestWinRate)} bei Δ Token{' '}
                    {formatSigned(entry.averageTokenDelta, 1)}.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => onSwitchView('shooter')}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Zum Arcade-Shooter
        </button>
        <button
          onClick={() => onSwitchView('chess')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Zum Schach-Arena
        </button>
      </div>
    </section>
  );
};

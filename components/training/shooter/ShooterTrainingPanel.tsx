import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ShooterAiInsight,
  ShooterDifficulty,
  ShooterSimulationResult,
  ShooterTrainingSummary,
} from '../../../types';
import {
  runShooterSimulation,
  runShooterTraining,
} from '../../../services/backgroundTrainingClient';
import {
  getTrainedShooterModel,
  importShooterModelFromFile,
  isShooterAiTrained,
  setTrainedShooterModel,
} from '../../../services/shooterAiService';
import { summarizeShooterSimulations } from '../../../services/shooterTrainingService';
import Spinner from '../../Spinner';
import {
  formatNumber,
  formatPercent,
  formatProfilePercent,
} from '../utils/formatting';

interface ShooterTrainingContextValue {
  shooterSimulationCount: number;
  setShooterSimulationCount: (value: number) => void;
  shooterDifficulty: ShooterDifficulty;
  setShooterDifficulty: (value: ShooterDifficulty) => void;
  shooterSimulations: ShooterSimulationResult[];
  shooterSummary: ShooterTrainingSummary | null;
  shooterInsights: ShooterAiInsight[];
  shooterStatus: string;
  shooterSimulationProgress: number;
  shooterTrainingProgress: number;
  isShooterSimulating: boolean;
  isShooterTraining: boolean;
  handleShooterSimulation: () => Promise<void>;
  handleShooterTraining: () => Promise<void>;
  shooterModelInputRef: React.RefObject<HTMLInputElement>;
  handleShooterModelImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleShooterModelUploadClick: () => void;
}

const ShooterTrainingContext = createContext<ShooterTrainingContextValue | undefined>(undefined);

const useShooterTrainingController = (): ShooterTrainingContextValue => {
  const [shooterSimulationCount, setShooterSimulationCount] = useState<number>(150);
  const [shooterDifficulty, setShooterDifficulty] = useState<ShooterDifficulty>('normal');
  const [shooterSimulations, setShooterSimulations] = useState<ShooterSimulationResult[]>([]);
  const [shooterSummary, setShooterSummary] = useState<ShooterTrainingSummary | null>(
    getTrainedShooterModel()?.summary ?? null
  );
  const [shooterInsights, setShooterInsights] = useState<ShooterAiInsight[]>(
    getTrainedShooterModel()?.insights ?? []
  );
  const [isShooterSimulating, setIsShooterSimulating] = useState<boolean>(false);
  const [shooterSimulationProgress, setShooterSimulationProgress] = useState<number>(0);
  const [isShooterTraining, setIsShooterTraining] = useState<boolean>(false);
  const [shooterTrainingProgress, setShooterTrainingProgress] = useState<number>(0);
  const [shooterStatus, setShooterStatus] = useState<string>(
    isShooterAiTrained()
      ? 'Arcade-Shooter-KI ist trainiert und aktiv.'
      : 'Arcade-Shooter-KI nutzt Standardmuster.'
  );
  const shooterModelInputRef = useRef<HTMLInputElement | null>(null);

  const handleShooterSimulation = useCallback(async () => {
    setIsShooterSimulating(true);
    setShooterSimulationProgress(0);
    setShooterTrainingProgress(0);
    setShooterStatus('Starte Arcade-Shooter-Hintergrundsimulation...');
    try {
      const results = await runShooterSimulation(shooterSimulationCount, {
        difficulty: shooterDifficulty,
        onProgress: (completed, total) => {
          const progressValue = total > 0 ? completed / total : 0;
          setShooterSimulationProgress(progressValue);
          setShooterStatus(`Simuliere Arcade-Shooter-Läufe (${completed}/${total})...`);
        },
      });
      setShooterSimulations(results);
      const summary = summarizeShooterSimulations(results);
      if (summary) {
        setShooterSummary(summary);
        setShooterStatus('Arcade-Shooter-Simulation abgeschlossen. Bereit für Training.');
      } else {
        setShooterStatus('Keine verwertbaren Shooter-Daten erzeugt.');
      }
    } catch (error) {
      console.error('Fehler bei der Arcade-Shooter-Simulation:', error);
      setShooterStatus('Fehler bei der Arcade-Shooter-Simulation.');
      setShooterSimulationProgress(0);
    } finally {
      setIsShooterSimulating(false);
    }
  }, [shooterSimulationCount, shooterDifficulty]);

  const handleShooterTraining = useCallback(async () => {
    if (shooterSimulations.length === 0) {
      setShooterStatus('Bitte führe zuerst Arcade-Shooter-Simulationen durch.');
      return;
    }
    setIsShooterTraining(true);
    setShooterTrainingProgress(0);
    setShooterStatus('Analysiere Arcade-Shooter-Simulationen im Hintergrund...');
    try {
      const model = await runShooterTraining(shooterSimulations, {
        onProgress: (progress) => {
          setShooterTrainingProgress(Math.min(1, progress));
        },
      });
      setTrainedShooterModel(model);
      setShooterSummary(model.summary);
      setShooterInsights(model.insights);
      setShooterStatus(`Arcade-Shooter-KI trainiert. ${model.describeProfile()}`);
      setShooterTrainingProgress(1);
    } catch (error) {
      console.error('Fehler beim Arcade-Shooter-Training:', error);
      setShooterStatus('Fehler beim Training der Arcade-Shooter-KI.');
      setShooterTrainingProgress(0);
    } finally {
      setIsShooterTraining(false);
    }
  }, [shooterSimulations]);

  const handleShooterModelImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setShooterStatus('Lade gespeichertes Arcade-Shooter-Modell...');
      try {
        const model = await importShooterModelFromFile(file);
        setShooterSummary(model.summary);
        setShooterInsights(model.insights);
        setShooterStatus(`Gespeichertes Arcade-Shooter-Modell geladen. ${model.describeProfile()}`);
      } catch (error) {
        console.error('Fehler beim Laden des Arcade-Shooter-Modells:', error);
        setShooterStatus('Gespeichertes Arcade-Shooter-Modell konnte nicht geladen werden.');
      } finally {
        event.target.value = '';
      }
    },
    []
  );

  const handleShooterModelUploadClick = useCallback(() => {
    shooterModelInputRef.current?.click();
  }, []);

  return {
    shooterSimulationCount,
    setShooterSimulationCount,
    shooterDifficulty,
    setShooterDifficulty,
    shooterSimulations,
    shooterSummary,
    shooterInsights,
    shooterStatus,
    shooterSimulationProgress,
    shooterTrainingProgress,
    isShooterSimulating,
    isShooterTraining,
    handleShooterSimulation,
    handleShooterTraining,
    shooterModelInputRef,
    handleShooterModelImport,
    handleShooterModelUploadClick,
  };
};

export const ShooterTrainingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useShooterTrainingController();
  return <ShooterTrainingContext.Provider value={value}>{children}</ShooterTrainingContext.Provider>;
};

export const useShooterTraining = (): ShooterTrainingContextValue => {
  const context = useContext(ShooterTrainingContext);
  if (!context) {
    throw new Error('useShooterTraining must be used within a ShooterTrainingProvider');
  }
  return context;
};

export const ShooterTrainingPanel: React.FC<{ onSwitchView: (view: 'card' | 'training' | 'chess' | 'shooter') => void }> = ({
  onSwitchView,
}) => {
  const {
    shooterSimulationCount,
    setShooterSimulationCount,
    shooterDifficulty,
    setShooterDifficulty,
    shooterSimulations,
    shooterSummary,
    shooterInsights,
    shooterStatus,
    shooterSimulationProgress,
    shooterTrainingProgress,
    isShooterSimulating,
    isShooterTraining,
    handleShooterSimulation,
    handleShooterTraining,
    shooterModelInputRef,
    handleShooterModelImport,
    handleShooterModelUploadClick,
  } = useShooterTraining();

  const topInsights = useMemo(() => shooterInsights.slice(0, 3), [shooterInsights]);

  return (
    <section className="w-full max-w-5xl bg-slate-900 rounded-xl shadow-2xl p-8 border border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-3xl font-bold text-cyan-200">Arcade-Shooter Simulation &amp; Training</h3>
          <p className="text-sm text-slate-300 mt-1">
            Simuliere Weltraumgefechte und trainiere die gegnerischen Staffeln für den Arcade-Shooter.
          </p>
        </div>
        <button
          onClick={() => onSwitchView('card')}
          className="bg-slate-600 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-md transition"
        >
          Zurück zum Kartenspiel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1" htmlFor="shooter-simulation-count">
              Anzahl zu simulierender Gefechte
            </label>
            <input
              id="shooter-simulation-count"
              type="number"
              min={30}
              step={10}
              value={shooterSimulationCount}
              onChange={(event) => setShooterSimulationCount(Number(event.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1" htmlFor="shooter-difficulty">
              Schwierigkeitsgrad
            </label>
            <select
              id="shooter-difficulty"
              value={shooterDifficulty}
              onChange={(event) => setShooterDifficulty(event.target.value as ShooterDifficulty)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="normal">Normal</option>
              <option value="veteran">Veteran</option>
              <option value="elite">Elite</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleShooterSimulation}
              disabled={isShooterSimulating}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-500 flex items-center justify-center"
            >
              {isShooterSimulating && <Spinner />}
              {isShooterSimulating ? 'Simuliere...' : 'Shooter-Simulation starten'}
            </button>
            <button
              onClick={handleShooterTraining}
              disabled={isShooterTraining || shooterSimulations.length === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-500 flex items-center justify-center"
            >
              {isShooterTraining && <Spinner />}
              {isShooterTraining ? 'Trainiere...' : 'Shooter-Training starten'}
            </button>
          </div>
          {(isShooterSimulating || shooterSimulationProgress > 0) && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Simulation</span>
                <span>{Math.round(shooterSimulationProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, shooterSimulationProgress * 100))}%` }}
                />
              </div>
            </div>
          )}
          {(isShooterTraining || shooterTrainingProgress > 0) && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Training</span>
                <span>{Math.round(shooterTrainingProgress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, shooterTrainingProgress * 100))}%` }}
                />
              </div>
            </div>
          )}
          <button
            onClick={handleShooterModelUploadClick}
            className="w-full border border-slate-600 text-slate-200 hover:bg-slate-800 rounded-md py-2"
          >
            Gespeichertes Modell importieren
          </button>
          <input
            ref={shooterModelInputRef}
            type="file"
            accept="application/json"
            onChange={handleShooterModelImport}
            className="hidden"
          />
        </div>

        <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-4 text-sm text-slate-200">
          <p className="text-slate-300">{shooterStatus}</p>
          {shooterSummary ? (
            <div className="space-y-3 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-white">Simulationen:</span>{' '}
                  {formatNumber(shooterSummary.totalSimulations)}
                </div>
                <div>
                  <span className="font-semibold text-white">Ø Score:</span>{' '}
                  {shooterSummary.averageScore.toFixed(1)}
                </div>
                <div>
                  <span className="font-semibold text-white">Bester Score:</span>{' '}
                  {shooterSummary.bestScore.toFixed(1)}
                </div>
                <div>
                  <span className="font-semibold text-white">Ø Genauigkeit:</span>{' '}
                  {formatPercent(shooterSummary.averageAccuracy)}
                </div>
                <div>
                  <span className="font-semibold text-white">Ø Wellen:</span>{' '}
                  {shooterSummary.averageWaves.toFixed(1)}
                </div>
                <div>
                  <span className="font-semibold text-white">Ø Leben verloren:</span>{' '}
                  {shooterSummary.averageLivesLost.toFixed(2)}
                </div>
                <div>
                  <span className="font-semibold text-white">Ø Schaden an Spieler:</span>{' '}
                  {shooterSummary.averageDamageToPlayer.toFixed(1)}
                </div>
                <div>
                  <span className="font-semibold text-white">Empfohlener Modus:</span>{' '}
                  {shooterSummary.recommendedDifficulty}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Profil: Aggression {formatProfilePercent(shooterSummary.recommendedProfile.aggression)} · Präzision{' '}
                {formatProfilePercent(shooterSummary.recommendedProfile.accuracy)} · Ausweichmanöver{' '}
                {formatProfilePercent(shooterSummary.recommendedProfile.evasiveness)} · Formation{' '}
                {formatProfilePercent(shooterSummary.recommendedProfile.coordination)} · Feuerstöße{' '}
                {formatProfilePercent(shooterSummary.recommendedProfile.burstiness)}
              </p>
              {topInsights.length > 0 && (
                <div className="mt-3 space-y-2">
                  <h4 className="text-sm font-semibold text-white">Taktische Erkenntnisse</h4>
                  <ul className="space-y-2">
                    {topInsights.map((insight, index) => (
                      <li key={`${insight.focus}-${index}`} className="border border-slate-700 rounded-md px-3 py-2">
                        <p className="font-semibold text-slate-100">{insight.focus}</p>
                        <p className="text-xs text-slate-300">{insight.summary}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Threat-Index: {insight.threatIndex.toFixed(1)} · Stichprobe {formatNumber(insight.dataPoints)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 mt-4">Noch keine Shooter-Simulationen durchgeführt.</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => onSwitchView('training')}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Zum Trainingszentrum
        </button>
        <button
          onClick={() => onSwitchView('chess')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg text-lg"
        >
          Zur Schach-Arena
        </button>
      </div>
    </section>
  );
};


import React, { useState, useCallback } from 'react';
import {
  RoundResult,
  SimulationAnalysis,
  TrainingAnalysis,
  ContextInsight,
  ChessSimulationResult,
  ChessTrainingSummary,
  ChessAiInsight
} from '../types';
import { simulateGames, trainModel } from '../services/trainingService';
import { simulateChessGames, summarizeChessSimulations, trainChessModel } from '../services/chessTrainingService';
import { setTrainedModel, isAiTrained } from '../services/aiService';
import { setTrainedChessModel, isChessAiTrained } from '../services/chessAiService';
import Spinner from './Spinner';
import CardGenerator from './CardGenerator';

const getMostFrequent = <T,>(items: T[]): T | null => {
  if (items.length === 0) {
    return null;
  }

  const counts = new Map<T, number>();
  let bestItem: T | null = null;
  let bestCount = 0;

  for (const item of items) {
    const newCount = (counts.get(item) ?? 0) + 1;
    counts.set(item, newCount);
    if (newCount > bestCount) {
      bestCount = newCount;
      bestItem = item;
    }
  }

  return bestItem;
};

const buildSimulationAnalysis = (data: RoundResult[]): SimulationAnalysis => {
  if (data.length === 0) {
    return {
      totalRounds: 0,
      playerWins: 0,
      aiWins: 0,
      draws: 0,
      playerWinRate: 0,
      aiWinRate: 0,
      averagePlayerTokens: 0,
      averageAiTokens: 0,
      mostCommonPlayerCard: null,
      mostCommonAiCard: null,
      mostCommonWeather: null,
      mostCommonPlayerHero: null,
      mostCommonAiHero: null,
    };
  }

  const totalRounds = data.length;
  let playerWins = 0;
  let aiWins = 0;
  let draws = 0;
  let playerTokenSum = 0;
  let aiTokenSum = 0;

  for (const round of data) {
    if (round.gewinner === 'spieler') playerWins += 1;
    if (round.gewinner === 'gegner') aiWins += 1;
    if (round.gewinner === 'unentschieden') draws += 1;

    playerTokenSum += round.spieler_token;
    aiTokenSum += round.gegner_token;
  }

  return {
    totalRounds,
    playerWins,
    aiWins,
    draws,
    playerWinRate: playerWins / totalRounds,
    aiWinRate: aiWins / totalRounds,
    averagePlayerTokens: playerTokenSum / totalRounds,
    averageAiTokens: aiTokenSum / totalRounds,
    mostCommonPlayerCard: getMostFrequent(data.map((round) => round.spieler_karte)),
    mostCommonAiCard: getMostFrequent(data.map((round) => round.gegner_karte)),
    mostCommonWeather: getMostFrequent(data.map((round) => round.wetter)) ?? null,
    mostCommonPlayerHero: getMostFrequent(data.map((round) => round.spieler_held)) ?? null,
    mostCommonAiHero: getMostFrequent(data.map((round) => round.gegner_held)) ?? null,
  };
};

type SimulationStatusTone = 'idle' | 'progress' | 'success' | 'error';

const STATUS_TONE_CLASS: Record<SimulationStatusTone, string> = {
  idle: 'text-slate-400',
  progress: 'text-slate-300',
  success: 'text-green-400',
  error: 'text-red-400',
};

const TrainingDashboard: React.FC<{ onSwitchView: (view: 'card' | 'training' | 'chess') => void }> = ({ onSwitchView }) => {
  const [simulationCount, setSimulationCount] = useState<number>(1000);
  const [simulationData, setSimulationData] = useState<RoundResult[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<string>(isAiTrained() ? 'KI ist trainiert und aktiv.' : 'KI nutzt zufällige Züge.');
  const [simulationAnalysis, setSimulationAnalysis] = useState<SimulationAnalysis | null>(null);
  const [trainingAnalysis, setTrainingAnalysis] = useState<TrainingAnalysis | null>(null);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationStatus, setSimulationStatus] = useState<string>('Bereit für Simulationen.');
  const [simulationStatusTone, setSimulationStatusTone] = useState<SimulationStatusTone>('idle');
  const [onlyHighTokenDelta, setOnlyHighTokenDelta] = useState<boolean>(false);
  const [focusWeather, setFocusWeather] = useState<'all' | 'regenWind'>('all');
  const [onlyDragonDuels, setOnlyDragonDuels] = useState<boolean>(false);
  const [chessSimulationCount, setChessSimulationCount] = useState<number>(200);
  const [chessSimulations, setChessSimulations] = useState<ChessSimulationResult[]>([]);
  const [chessSummary, setChessSummary] = useState<ChessTrainingSummary | null>(null);
  const [chessInsights, setChessInsights] = useState<ChessAiInsight[]>([]);
  const [isChessSimulating, setIsChessSimulating] = useState<boolean>(false);
  const [chessSimulationProgress, setChessSimulationProgress] = useState<number>(0);
  const [isChessTraining, setIsChessTraining] = useState<boolean>(false);
  const [chessStatus, setChessStatus] = useState<string>(
    isChessAiTrained() ? 'Schach-KI ist trainiert und aktiv.' : 'Schach-KI nutzt heuristische Heuristiken.'
  );

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString('de-DE');
  const formatTokenDelta = (delta: number) => (delta > 0 ? `+${delta}` : `${delta}`);
  const describeTokenAdvantage = (delta: number) => {
    if (delta > 0) return 'zugunsten des Spielers';
    if (delta < 0) return 'zugunsten der KI';
    return 'ohne Token-Vorsprung';
  };

  const formatInterval = (lower: number, upper: number) => `${(lower * 100).toFixed(1)}–${(upper * 100).toFixed(1)}%`;
  const formatEvidence = (score: number) => `${(score * 100).toFixed(1)}%`;

  const buildBadges = (context: ContextInsight) => {
    const badges: { label: string; color: string }[] = [];
    if (context.observations < 10) badges.push({ label: 'fragil', color: 'bg-amber-600' });
    if (context.wilsonLower < 0.5) badges.push({ label: 'unsicher', color: 'bg-red-700' });
    if (context.observations >= 100) badges.push({ label: 'stabil', color: 'bg-emerald-700' });
    return badges;
  };

  const handleChessSimulation = useCallback(async () => {
    setIsChessSimulating(true);
    setChessSimulationProgress(0);
    setChessStatus('Starte Schach-Simulation...');
    try {
      const results = await simulateChessGames(chessSimulationCount, {}, (completed, total) => {
        setChessSimulationProgress(completed / total);
        setChessStatus(`Simuliere Schachpartien (${completed}/${total})...`);
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

  const handleChessTraining = useCallback(() => {
    if (chessSimulations.length === 0) {
      setChessStatus('Bitte führe zuerst Schach-Simulationen durch.');
      return;
    }
    setIsChessTraining(true);
    try {
      const model = trainChessModel(chessSimulations);
      setTrainedChessModel(model);
      setChessSummary(model.summary);
      setChessInsights(model.insights.slice(0, 12));
      setChessStatus('Schach-KI erfolgreich trainiert und aktiviert.');
    } catch (error) {
      console.error('Fehler beim Schach-Training:', error);
      setChessStatus('Fehler beim Training der Schach-KI.');
    } finally {
      setIsChessTraining(false);
    }
  }, [chessSimulations]);

  const matchesContextFilters = useCallback(
    (context: ContextInsight) => {
      if (onlyHighTokenDelta && context.tokenDelta < 3) {
        return false;
      }
      if (
        focusWeather === 'regenWind' &&
        context.weather !== 'Regen' &&
        context.weather !== 'Windsturm'
      ) {
        return false;
      }
      if (
        onlyDragonDuels &&
        !(context.playerHero.includes('Drache') && context.aiHero.includes('Drache'))
      ) {
        return false;
      }
      return true;
    },
    [focusWeather, onlyDragonDuels, onlyHighTokenDelta]
  );

  const renderContextList = (
    title: string,
    contexts: TrainingAnalysis['topContexts'],
    emptyMessage?: string
  ) => {
    const filteredContexts = (contexts ?? []).filter(matchesContextFilters);

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
                Spielerkarte <span className="text-purple-300">{context.playerCard}</span> bei Wetter{' '}
                <span className="text-purple-300">{context.weather}</span> wird am besten mit{' '}
                <span className="text-purple-300">{context.aiCard}</span> beantwortet.
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Helden-Duell{' '}
                <span className="text-purple-300">{context.playerHero}</span> vs.{` `}
                <span className="text-purple-300">{context.aiHero}</span> bei einer Token-Differenz von{' '}
                <span className="text-purple-300">{formatTokenDelta(context.tokenDelta)}</span>{' '}
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
                · Beobachtungen: {formatNumber(context.observations)}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Wilson-95%:{' '}
                <span className="text-cyan-300">{formatInterval(context.wilsonLower, context.wilsonUpper)}</span> · Evidenzscore:{' '}
                <span className="text-cyan-300">{formatEvidence(context.evidenceScore)}</span> · Lift vs. Baseline:{' '}
                <span className={context.lift >= 0 ? 'text-emerald-300' : 'text-red-400'}>
                  {context.lift >= 0 ? '+' : ''}
                  {formatPercent(context.lift)}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {buildBadges(context).map((badge) => (
                  <span
                    key={`${context.playerCard}-${badge.label}`}
                    className={`uppercase text-[10px] tracking-wide px-2 py-1 rounded-full text-white ${badge.color}`}
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
  
  const handleSimulate = useCallback(() => {
    const runSimulation = async () => {
      setIsSimulating(true);
      setSimulationProgress(0);
      setSimulationStatus('Starte Simulation...');
      setSimulationStatusTone('progress');
      setSimulationData([]);
      setSimulationAnalysis(null);
      setTrainingAnalysis(null);

      try {
        const data = await simulateGames(simulationCount, {
          onProgress: (completed, total) => {
            const safeTotal = total > 0 ? total : 1;
            setSimulationProgress(Math.min(1, completed / safeTotal));
            setSimulationStatus(
              total > 0
                ? `Simuliere Spiele... ${completed}/${total}`
                : 'Simuliere Spiele...'
            );
            setSimulationStatusTone('progress');
          },
        });
        setSimulationData(data);
        setSimulationAnalysis(buildSimulationAnalysis(data));
        setSimulationProgress(1);
        setSimulationStatus(
          `Simulation abgeschlossen! ${data.length.toLocaleString('de-DE')} Runden aufgezeichnet.`
        );
        setSimulationStatusTone('success');
      } catch (error) {
        console.error(error);
        setSimulationProgress(0);
        setSimulationStatus('Simulation abgebrochen oder fehlgeschlagen.');
        setSimulationStatusTone('error');
      } finally {
        setIsSimulating(false);
      }
    };

    void runSimulation();
  }, [simulationCount]);

  const handleTrain = useCallback(() => {
    if (simulationData.length === 0) {
        alert("Bitte zuerst Spiele simulieren, um Trainingsdaten zu erzeugen.");
        return;
    }
    setIsTraining(true);
     // Use timeout to allow UI to update before blocking
    setTimeout(() => {
        const model = trainModel(simulationData);
        setTrainedModel(model);
        setTrainingAnalysis(model.analysis);
        setAiStatus('KI wurde mit neuen Daten trainiert und ist aktiv.');
        setIsTraining(false);
    }, 50);
  }, [simulationData]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-800 p-8">
      <div className="w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl p-8 border border-slate-700">
        <h1 className="text-4xl font-bold text-center mb-2 text-purple-400">KI Trainingszentrum</h1>
        <p className="text-center text-slate-400 mb-8">Hier kannst du die KI trainieren, um bessere Entscheidungen zu treffen.</p>
        
        <CardGenerator />

        <div className="mb-6 p-4 bg-slate-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-2 text-cyan-300">Aktueller KI-Status</h2>
            <p className="text-slate-300">{aiStatus}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Simulation Section */}
            <div className="bg-slate-800 p-6 rounded-lg">
                <h3 className="text-2xl font-bold mb-4">Schritt 1: Simulation</h3>
                <p className="mb-4 text-slate-400">Generiere Spieldaten, indem du eine große Anzahl von Spielen simulierst.</p>
                <div className="mb-4">
                    <label htmlFor="sim-count" className="block mb-2 font-medium">Anzahl der Simulationen</label>
                    <input
                        type="number"
                        id="sim-count"
                        value={simulationCount}
                        onChange={(e) => setSimulationCount(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:ring-2 focus:ring-purple-500"
                        min="100"
                        step="100"
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
                        style={{
                          width: `${Math.min(100, Math.max(0, simulationProgress * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-slate-300 text-sm text-center">{simulationStatus}</p>
                  </div>
                )}
                {!isSimulating && simulationStatus && (
                  <p
                    className={`mt-4 text-center ${STATUS_TONE_CLASS[simulationStatusTone]}`}
                  >
                    {simulationStatus}
                  </p>
                )}
            </div>
            
            {/* Training Section */}
            <div className="bg-slate-800 p-6 rounded-lg">
                <h3 className="text-2xl font-bold mb-4">Schritt 2: Training</h3>
                <p className="mb-4 text-slate-400">Nutze die simulierten Daten, um ein Entscheidungsmodell für die KI zu erstellen.</p>
                <button
                    onClick={handleTrain}
                    disabled={isTraining || simulationData.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isTraining && <Spinner />}
                    {isTraining ? 'Trainiere...' : 'Trainiere KI mit Daten'}
                </button>
                 {simulationData.length === 0 &&
                    <p className="mt-4 text-yellow-400 text-center text-sm">Warte auf Simulationsdaten...</p>
                }
            </div>
        </div>
        
        {simulationAnalysis && (
            <div className="mt-8 bg-slate-800 p-6 rounded-lg">
                <h3 className="text-2xl font-bold mb-4 text-cyan-300">Simulationsanalyse</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
                    <div>
                        <span className="font-semibold text-white">Gesamte Runden:</span> {formatNumber(simulationAnalysis.totalRounds)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Spieler Siegquote:</span> {formatPercent(simulationAnalysis.playerWinRate)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">KI Siegquote:</span> {formatPercent(simulationAnalysis.aiWinRate)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Unentschieden:</span> {formatPercent(simulationAnalysis.totalRounds > 0 ? simulationAnalysis.draws / simulationAnalysis.totalRounds : 0)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Ø Spieler-Token nach Runden:</span> {simulationAnalysis.averagePlayerTokens.toFixed(2)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Ø KI-Token nach Runden:</span> {simulationAnalysis.averageAiTokens.toFixed(2)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Häufigste Spielerkarte:</span> {simulationAnalysis.mostCommonPlayerCard ?? '–'}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Häufigste KI-Karte:</span> {simulationAnalysis.mostCommonAiCard ?? '–'}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Beliebtestes Wetter:</span> {simulationAnalysis.mostCommonWeather ?? '–'}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Spielerheld (häufig):</span> {simulationAnalysis.mostCommonPlayerHero ?? '–'}
                    </div>
                    <div>
                        <span className="font-semibold text-white">KI-Held (häufig):</span> {simulationAnalysis.mostCommonAiHero ?? '–'}
                    </div>
                </div>
            </div>
        )}

        {trainingAnalysis && (
            <div className="mt-8 bg-slate-800 p-6 rounded-lg">
                <h3 className="text-2xl font-bold mb-4 text-green-300">Trainingsanalyse</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-slate-300">
                    <div>
                        <span className="font-semibold text-white">Kontexte insgesamt:</span> {formatNumber(trainingAnalysis.totalContexts)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Gut abgedeckte Kontexte:</span> {formatNumber(trainingAnalysis.contextsWithSolidData)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Kontexte mit wenig Daten:</span> {formatNumber(trainingAnalysis.contextsNeedingData)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Ø beste Siegquote:</span> {formatPercent(trainingAnalysis.averageBestWinRate)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Mechaniken getrackt:</span> {formatNumber(trainingAnalysis.mechanicEffectiveness.length)}
                    </div>
                    <div>
                        <span className="font-semibold text-white">Helden-Matchups analysiert:</span> {formatNumber(trainingAnalysis.heroMatchupInsights.length)}
                    </div>
                </div>

                <div className="mt-4 bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-3">Filter für Kontextlisten</h4>
                    <div className="flex flex-wrap gap-3">
                        <button
                            className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                                onlyHighTokenDelta ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'
                            }`}
                            onClick={() => setOnlyHighTokenDelta((prev) => !prev)}
                            aria-pressed={onlyHighTokenDelta}
                        >
                            +ΔToken ≥ +3
                        </button>
                        <button
                            className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                                focusWeather === 'regenWind' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'
                            }`}
                            onClick={() => setFocusWeather((prev) => (prev === 'regenWind' ? 'all' : 'regenWind'))}
                            aria-pressed={focusWeather === 'regenWind'}
                        >
                            Regen & Windsturm
                        </button>
                        <button
                            className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                                onlyDragonDuels ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-200'
                            }`}
                            onClick={() => setOnlyDragonDuels((prev) => !prev)}
                            aria-pressed={onlyDragonDuels}
                        >
                            Drache vs. Drache
                        </button>
                    </div>
                </div>

                {trainingAnalysis.bestContext && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-lg text-slate-200 border border-slate-700">
                        <p className="font-semibold text-white mb-2">Stärkstes Szenario</p>
                        <p>
                            Spielerkarte <span className="text-purple-300">{trainingAnalysis.bestContext.playerCard}</span> bei Wetter{' '}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.weather}</span> wird am besten mit{' '}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.aiCard}</span> beantwortet.
                        </p>
                        <p className="mt-2">
                            Helden-Duell{' '}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.playerHero}</span> vs.{` `}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.aiHero}</span> bei einer Token-Differenz von{' '}
                            <span className="text-purple-300">{formatTokenDelta(trainingAnalysis.bestContext.tokenDelta)}</span>{' '}
                            {describeTokenAdvantage(trainingAnalysis.bestContext.tokenDelta)}.
                        </p>
                        <p>
                            <span
                                className="text-green-400"
                                title={`Quote: ${formatPercent(trainingAnalysis.bestContext.winRate)} | N=${formatNumber(
                                    trainingAnalysis.bestContext.observations
                                )} | Wilson: ${formatInterval(
                                    trainingAnalysis.bestContext.wilsonLower,
                                    trainingAnalysis.bestContext.wilsonUpper
                                )} | Evidenz: ${formatEvidence(trainingAnalysis.bestContext.evidenceScore)}`}
                            >
                                Siegquote: {formatPercent(trainingAnalysis.bestContext.winRate)}
                            </span>{' '}
                            auf Grundlage von {formatNumber(trainingAnalysis.bestContext.observations)} Beobachtungen.
                        </p>
                        <p className="mt-1">
                            Wilson-95%:{' '}
                            <span className="text-cyan-300">
                                {formatInterval(
                                    trainingAnalysis.bestContext.wilsonLower,
                                    trainingAnalysis.bestContext.wilsonUpper
                                )}
                            </span>{' '}
                            · Evidenzscore:{' '}
                            <span className="text-cyan-300">
                                {formatEvidence(trainingAnalysis.bestContext.evidenceScore)}
                            </span>{' '}
                            · Lift vs. Baseline:{' '}
                            <span
                                className={
                                    trainingAnalysis.bestContext.lift >= 0 ? 'text-emerald-300' : 'text-red-400'
                                }
                            >
                                {trainingAnalysis.bestContext.lift >= 0 ? '+' : ''}
                                {formatPercent(trainingAnalysis.bestContext.lift)}
                            </span>
                        </p>
                        <div className="mt-2 flex gap-2">
                            {buildBadges(trainingAnalysis.bestContext).map((badge) => (
                                <span
                                    key={`best-${badge.label}`}
                                    className={`uppercase text-[10px] tracking-wide px-2 py-1 rounded-full text-white ${badge.color}`}
                                >
                                    {badge.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {renderContextList('Top Sieg-Szenarien', trainingAnalysis.topContexts)}
                {renderContextList(
                    'Problematische Szenarien',
                    trainingAnalysis.strugglingContexts,
                    'Noch keine Szenarien mit ausreichend Daten, die als Schwachstellen gelten.'
                )}
                {renderContextList(
                    'Datenlücken (unter 5 Beobachtungen)',
                    trainingAnalysis.dataGaps,
                    'Alle aktuell gelernten Kontexte besitzen mindestens fünf Beobachtungen.'
                )}
                {renderContextList(
                    'Entropie-Alerts (H < 0.3)',
                    trainingAnalysis.decisionEntropyAlerts,
                    'Alle Kontexte besitzen ausreichende Entscheidungsvielfalt.'
                )}

                {trainingAnalysis.resamplingPlan.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-xl font-semibold text-white mb-3">Simulation-Planner Empfehlungen</h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="uppercase text-xs text-slate-400">
                                    <tr>
                                        <th className="py-2 pr-4">Priorität</th>
                                        <th className="py-2 pr-4">Welle</th>
                                        <th className="py-2 pr-4">Kontext</th>
                                        <th className="py-2 pr-4">Status</th>
                                        <th className="py-2 pr-4">Ziel</th>
                                        <th className="py-2 pr-4">Begründung</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainingAnalysis.resamplingPlan.map((entry, index) => (
                                        <tr key={`${entry.context.playerCard}-${entry.context.aiCard}-${index}`} className="border-t border-slate-700 text-slate-300">
                                            <td className="py-2 pr-4 font-semibold text-white">{entry.priority}</td>
                                            <td className="py-2 pr-4">Welle {entry.wave}</td>
                                            <td className="py-2 pr-4">
                                                <div className="text-sm">
                                                    <p>
                                                        <span className="text-purple-300">{entry.context.playerCard}</span> →{' '}
                                                        <span className="text-purple-300">{entry.context.aiCard}</span>
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        Wetter {entry.context.weather} · ΔToken {formatTokenDelta(entry.context.tokenDelta)}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="py-2 pr-4">
                                                N={formatNumber(entry.currentObservations)} · Wilson:{' '}
                                                {formatInterval(entry.context.wilsonLower, entry.context.wilsonUpper)}
                                            </td>
                                            <td className="py-2 pr-4">{formatNumber(entry.targetObservations)}</td>
                                            <td className="py-2 pr-4 text-xs text-slate-300">{entry.rationale}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {trainingAnalysis.coverageByTokenDelta.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-xl font-semibold text-white mb-3">Token-Delta Abdeckung</h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="uppercase text-xs text-slate-400">
                                    <tr>
                                        <th className="py-2 pr-4">Delta</th>
                                        <th className="py-2 pr-4">Kontexte</th>
                                        <th className="py-2 pr-4">Solide Daten</th>
                                        <th className="py-2 pr-4">Ø Winrate</th>
                                        <th className="py-2 pr-4">Ø Baseline</th>
                                        <th className="py-2 pr-4">Ø Lift</th>
                                        <th className="py-2 pr-4">Ø Beobachtungen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainingAnalysis.coverageByTokenDelta.map((entry) => (
                                        <tr key={entry.tokenDelta} className="border-t border-slate-700 text-slate-300">
                                            <td className="py-2 pr-4">{formatTokenDelta(entry.tokenDelta)}</td>
                                            <td className="py-2 pr-4">{formatNumber(entry.contextCount)}</td>
                                            <td className="py-2 pr-4">{formatNumber(entry.solidDataContexts)}</td>
                                            <td
                                                className="py-2 pr-4"
                                                title={`Konter: ${formatPercent(entry.averageWinRate)} | Baseline: ${formatPercent(
                                                    entry.averageBaseline
                                                )} | Lift: ${formatPercent(entry.averageLift)}`}
                                            >
                                                {formatPercent(entry.averageWinRate)}
                                            </td>
                                            <td className="py-2 pr-4">{formatPercent(entry.averageBaseline)}</td>
                                            <td className="py-2 pr-4">
                                                <span
                                                    className={entry.averageLift >= 0 ? 'text-emerald-300' : 'text-red-400'}
                                                >
                                                    {entry.averageLift >= 0 ? '+' : ''}
                                                    {formatPercent(entry.averageLift)}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-4">{entry.averageObservations.toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {trainingAnalysis.heroMatchupInsights.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-xl font-semibold text-white mb-3">Helden-Matchup-Trends</h4>
                        <ul className="space-y-3">
                            {trainingAnalysis.heroMatchupInsights.map((insight, index) => (
                                <li key={`${insight.playerHero}-${insight.aiHero}-${index}`} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                    <p className="font-semibold text-white">
                                        {insight.playerHero} vs. {insight.aiHero}
                                    </p>
                                    <p className="text-sm text-slate-300">
                                        Kontexte: {formatNumber(insight.contexts)} · Beobachtungen: {formatNumber(insight.observations)} · Ø ΔToken:{' '}
                                        <span className="text-cyan-300">{insight.averageTokenDelta.toFixed(1)}</span> · Ø Konter-Winrate:{' '}
                                        <span
                                            className="text-green-400"
                                            title={`Quote: ${formatPercent(insight.averageBestWinRate)} | Ø ΔToken: ${insight.averageTokenDelta.toFixed(1)}`}
                                        >
                                            {formatPercent(insight.averageBestWinRate)}
                                        </span>
                                    </p>
                                    {insight.topCounter && (
                                        <p className="text-sm mt-1 text-slate-300">
                                            Beste Antwort:{' '}
                                            <span className="text-purple-300">{insight.topCounter.aiCard}</span> gegen{' '}
                                            <span className="text-purple-300">{insight.topCounter.playerCard}</span> bei{' '}
                                            <span className="text-purple-300">{insight.topCounter.weather}</span>.
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {trainingAnalysis.elementCounterInsights.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-xl font-semibold text-white mb-3">Elementare Konter</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {trainingAnalysis.elementCounterInsights.map((entry) => (
                                <div key={entry.playerElement} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                    <p className="font-semibold text-white mb-2">Gegen {entry.playerElement}</p>
                                    <ul className="space-y-2 text-sm text-slate-300">
                                        {entry.counters.map((counter) => (
                                            <li key={`${entry.playerElement}-${counter.aiCard}`}>
                                                <span className="text-purple-300">{counter.aiCard}</span> · Siegquote{' '}
                                                <span className="text-green-400">{formatPercent(counter.winRate)}</span> ({formatNumber(counter.observations)} Beobachtungen)
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {trainingAnalysis.mechanicEffectiveness.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-xl font-semibold text-white mb-3">Mechanik-Wirksamkeit</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {trainingAnalysis.mechanicEffectiveness.map((entry) => (
                                <div key={entry.mechanic} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                    <p className="font-semibold text-white">{entry.mechanic}</p>
                                    <p
                                        className="text-sm text-slate-300"
                                        title={`Quote: ${formatPercent(entry.winRate)} | Normierter Lift: ${formatPercent(entry.normalizedLift)} | Beobachtungen: ${formatNumber(entry.observations)}`}
                                    >
                                        Siegquote:{' '}
                                        <span className="text-green-400">{formatPercent(entry.winRate)}</span>
                                    </p>
                                    <p className="text-sm text-slate-300">
                                        Normierte Wirksamkeit:{' '}
                                        <span className={entry.normalizedLift >= 0 ? 'text-emerald-300' : 'text-red-400'}>
                                            {entry.normalizedLift >= 0 ? '+' : ''}
                                            {formatPercent(entry.normalizedLift)}
                                        </span>
                                    </p>
                                    <p className="text-sm text-slate-300">
                                        Beobachtungen: {formatNumber(entry.observations)} · Ø ΔToken:{' '}
                                        <span className="text-cyan-300">{entry.averageTokenDelta.toFixed(1)}</span> · Kontexte:{' '}
                                        {formatNumber(entry.contexts)}
                                    </p>
                                    {entry.weatherDistribution.length > 0 && (
                                        <p className="text-xs text-slate-400 mt-2">
                                            Wetter-Verteilung:{' '}
                                            {entry.weatherDistribution
                                                .slice(0, 3)
                                                .map(
                                                    (weather) =>
                                                        `${weather.weather} ${formatPercent(weather.share)}`
                                                )
                                                .join(' · ')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        <div className="mt-12 bg-slate-800/80 border border-slate-700 rounded-lg p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-cyan-200">Schach-Simulation &amp; Training</h3>
                    <p className="text-sm text-slate-300 mt-1">
                        Übertrage die Runenkrieg-Methodik auf Schachpartien: simuliere Spiele und trainiere die Gegenseite.
                    </p>
                </div>
                <button
                    onClick={() => onSwitchView('chess')}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-md transition"
                >
                    Zur Schach-Arena
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-300 mb-1" htmlFor="chess-simulation-count">
                            Anzahl zu simulierender Partien
                        </label>
                        <input
                            id="chess-simulation-count"
                            type="number"
                            min={10}
                            max={5000}
                            step={10}
                            value={chessSimulationCount}
                            onChange={(event) => setChessSimulationCount(Number(event.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleChessSimulation}
                            disabled={isChessSimulating}
                            className={`px-4 py-2 rounded-md font-semibold transition ${
                                isChessSimulating
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                        >
                            {isChessSimulating
                                ? `Simuliere... ${Math.round(chessSimulationProgress * 100)}%`
                                : 'Schach-Simulation starten'}
                        </button>
                        <button
                            onClick={handleChessTraining}
                            disabled={isChessTraining || chessSimulations.length === 0}
                            className={`px-4 py-2 rounded-md font-semibold transition ${
                                isChessTraining || chessSimulations.length === 0
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                            }`}
                        >
                            {isChessTraining ? 'Trainiere...' : 'Schach-KI trainieren'}
                        </button>
                    </div>
                    <p className="text-sm text-slate-300">{chessStatus}</p>
                    {isChessSimulating && (
                        <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-200"
                                style={{ width: `${Math.min(100, Math.round(chessSimulationProgress * 100))}%` }}
                            />
                        </div>
                    )}
                    {chessSimulations.length > 0 && (
                        <p className="text-xs text-slate-400">
                            Zuletzt simuliert: {formatNumber(chessSimulations.length)} Partien.
                        </p>
                    )}
                </div>

                <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-4 text-sm text-slate-200">
                    {chessSummary ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <span className="font-semibold text-white">Partien:</span> {formatNumber(chessSummary.totalGames)}
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Weiß gewinnt:</span>{' '}
                                    {chessSummary.totalGames > 0
                                        ? formatPercent(chessSummary.whiteWins / chessSummary.totalGames)
                                        : '0%'}
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Schwarz gewinnt:</span>{' '}
                                    {chessSummary.totalGames > 0
                                        ? formatPercent(chessSummary.blackWins / chessSummary.totalGames)
                                        : '0%'}
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Remis:</span>{' '}
                                    {chessSummary.totalGames > 0
                                        ? formatPercent(chessSummary.draws / chessSummary.totalGames)
                                        : '0%'}
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Ø Halbzüge:</span>{' '}
                                    {chessSummary.averagePlies.toFixed(1)}
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Entscheidungen:</span>{' '}
                                    {formatPercent(chessSummary.decisiveRate)}
                                </div>
                            </div>
                            {chessSummary.topOpenings.length > 0 && (
                                <div>
                                    <p className="font-semibold text-white mt-3">Beliebte Eröffnungssequenzen</p>
                                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                                        {chessSummary.topOpenings.map((opening) => (
                                            <li key={opening.sequence} className="border-b border-slate-700/60 pb-1">
                                                <span className="text-purple-300">{opening.sequence}</span> · {formatNumber(opening.count)} Partien · Score{' '}
                                                {formatPercent(opening.winRate)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-slate-400">Noch keine Schach-Simulationen durchgeführt.</p>
                    )}
                </div>
            </div>

            {chessInsights.length > 0 && (
                <div className="mt-6">
                    <h4 className="text-lg font-semibold text-white mb-3">Top KI-Empfehlungen</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {chessInsights.slice(0, 6).map((insight, index) => (
                            <div key={`${insight.fen}-${insight.recommendedMove}-${index}`} className="bg-slate-900/70 border border-slate-700 rounded-lg p-4 text-sm text-slate-200">
                                <p className="font-semibold text-white">Zug {insight.recommendedMove}</p>
                                <p className="text-xs text-slate-400 break-all mt-1">{insight.fen}</p>
                                <p className="mt-2">
                                    Erwarteter Score:{' '}
                                    <span className="text-green-400">{formatPercent(insight.expectedScore)}</span> · Vertrauen{' '}
                                    <span className="text-cyan-300">{formatPercent(insight.confidence)}</span>
                                </p>
                                <p className="text-xs text-slate-400">Beobachtungen: {formatNumber(insight.sampleSize)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="mt-8 text-center">
            <button onClick={() => onSwitchView('card')} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg text-lg">
                Zurück zum Spiel
            </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingDashboard;

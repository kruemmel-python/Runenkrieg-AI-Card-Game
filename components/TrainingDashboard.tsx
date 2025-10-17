
import React, { useState, useCallback } from 'react';
import { RoundResult, SimulationAnalysis, TrainingAnalysis } from '../types';
import { simulateGames, trainModel } from '../services/trainingService';
import { setTrainedModel, isAiTrained } from '../services/aiService';
import Spinner from './Spinner';

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

const TrainingDashboard: React.FC<{ onSwitchView: (view: 'game' | 'training') => void }> = ({ onSwitchView }) => {
  const [simulationCount, setSimulationCount] = useState<number>(1000);
  const [simulationData, setSimulationData] = useState<RoundResult[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<string>(isAiTrained() ? 'KI ist trainiert und aktiv.' : 'KI nutzt zufällige Züge.');
  const [simulationAnalysis, setSimulationAnalysis] = useState<SimulationAnalysis | null>(null);
  const [trainingAnalysis, setTrainingAnalysis] = useState<TrainingAnalysis | null>(null);

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString('de-DE');
  const formatTokenDelta = (delta: number) => (delta > 0 ? `+${delta}` : `${delta}`);
  const describeTokenAdvantage = (delta: number) => {
    if (delta > 0) return 'zugunsten des Spielers';
    if (delta < 0) return 'zugunsten der KI';
    return 'ohne Token-Vorsprung';
  };

  const renderContextList = (
    title: string,
    contexts: TrainingAnalysis['topContexts'],
    emptyMessage?: string
  ) => {
    if (!contexts || contexts.length === 0) {
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
          {contexts.map((context, index) => (
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
                Siegquote: <span className="text-green-400">{formatPercent(context.winRate)}</span> ·{' '}
                Beobachtungen: {formatNumber(context.observations)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  const handleSimulate = useCallback(() => {
    setIsSimulating(true);
    setSimulationData([]);
    setSimulationAnalysis(null);
    setTrainingAnalysis(null);
    // Use timeout to allow UI to update before blocking
    setTimeout(() => {
        const data = simulateGames(simulationCount);
        setSimulationData(data);
        setSimulationAnalysis(buildSimulationAnalysis(data));
        setIsSimulating(false);
    }, 50);
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
                {simulationData.length > 0 && !isSimulating &&
                    <p className="mt-4 text-green-400 text-center">Simulation abgeschlossen! {simulationData.length} Runden aufgezeichnet.</p>
                }
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
                            Siegquote: <span className="text-green-400">{formatPercent(trainingAnalysis.bestContext.winRate)}</span> auf Grundlage von{' '}
                            {formatNumber(trainingAnalysis.bestContext.observations)} Beobachtungen.
                        </p>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainingAnalysis.coverageByTokenDelta.map((entry) => (
                                        <tr key={entry.tokenDelta} className="border-t border-slate-700 text-slate-300">
                                            <td className="py-2 pr-4">{formatTokenDelta(entry.tokenDelta)}</td>
                                            <td className="py-2 pr-4">{formatNumber(entry.contextCount)}</td>
                                            <td className="py-2 pr-4">{formatNumber(entry.solidDataContexts)}</td>
                                            <td className="py-2 pr-4">{formatPercent(entry.averageWinRate)}</td>
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
                                        Kontexte: {formatNumber(insight.contexts)} · Beobachtungen: {formatNumber(insight.observations)} · Ø Konter-Winrate:{' '}
                                        <span className="text-green-400">{formatPercent(insight.averageBestWinRate)}</span>
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
                                    <p className="text-sm text-slate-300">Siegquote: <span className="text-green-400">{formatPercent(entry.winRate)}</span></p>
                                    <p className="text-sm text-slate-300">Beobachtungen: {formatNumber(entry.observations)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        <div className="mt-8 text-center">
            <button onClick={() => onSwitchView('game')} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg text-lg">
                Zurück zum Spiel
            </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingDashboard;

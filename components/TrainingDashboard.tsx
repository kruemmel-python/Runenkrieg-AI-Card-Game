
import React, { useState, useCallback } from 'react';
import { RoundResult } from '../types';
import { simulateGames, trainModel } from '../services/trainingService';
import { setTrainedModel, isAiTrained } from '../services/aiService';
import Spinner from './Spinner';

const TrainingDashboard: React.FC<{ onSwitchView: (view: 'game' | 'training') => void }> = ({ onSwitchView }) => {
  const [simulationCount, setSimulationCount] = useState<number>(1000);
  const [simulationData, setSimulationData] = useState<RoundResult[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<string>(isAiTrained() ? 'KI ist trainiert und aktiv.' : 'KI nutzt zufällige Züge.');
  
  const handleSimulate = useCallback(() => {
    setIsSimulating(true);
    setSimulationData([]);
    // Use timeout to allow UI to update before blocking
    setTimeout(() => {
        const data = simulateGames(simulationCount);
        setSimulationData(data);
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

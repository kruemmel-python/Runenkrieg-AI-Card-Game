import React, { useCallback, useState } from 'react';
import type { GameSnapshot, ShipDNA } from '../../React-Retro-Arcade-Space-Shooter/types';
import { MainMenu } from '../../React-Retro-Arcade-Space-Shooter/components/MainMenu';
import { GameCanvas } from '../../React-Retro-Arcade-Space-Shooter/components/GameCanvas';
import { Hud } from '../../React-Retro-Arcade-Space-Shooter/components/Hud';
import { GameOverScreen } from '../../React-Retro-Arcade-Space-Shooter/components/GameOverScreen';

export type RootView = 'card' | 'training' | 'chess' | 'shooter';

type ShooterGameState = 'main-menu' | 'playing' | 'game-over';

const ArcadeShooterArena: React.FC<{ onSwitchView: (view: RootView) => void }> = ({ onSwitchView }) => {
  const [gameState, setGameState] = useState<ShooterGameState>('main-menu');
  const [playerDna, setPlayerDna] = useState<ShipDNA | null>(null);
  const [campaignSeed, setCampaignSeed] = useState<string>('');
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [finalScore, setFinalScore] = useState<number>(0);

  const handleStartGame = useCallback((dna: ShipDNA, seed: string) => {
    setPlayerDna(dna);
    setCampaignSeed(seed);
    setGameState('playing');
  }, []);

  const handleSnapshot = useCallback((value: GameSnapshot | null) => {
    setSnapshot(value);
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setGameState('game-over');
  }, []);

  const handleReturnToMenu = useCallback(() => {
    setPlayerDna(null);
    setCampaignSeed('');
    setSnapshot(null);
    setFinalScore(0);
    setGameState('main-menu');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-cyan-200">Runenkrieg · Arcade-Shooter</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSwitchView('training')}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-md transition"
            >
              Zurück zum Trainingscenter
            </button>
            <button
              onClick={() => onSwitchView('card')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-md transition"
            >
              Runenkrieg spielen
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {gameState === 'main-menu' && (
          <div className="absolute inset-0">
            <MainMenu onStartGame={handleStartGame} />
          </div>
        )}

        {playerDna && campaignSeed && (
          <GameCanvas
            playerDna={playerDna}
            seed={campaignSeed}
            onSnapshot={handleSnapshot}
            onGameOver={handleGameOver}
            active={gameState === 'playing'}
          />
        )}

        {gameState === 'playing' && <Hud snapshot={snapshot} />}

        {gameState === 'game-over' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
            <GameOverScreen score={finalScore} onRestart={handleReturnToMenu} />
          </div>
        )}
      </main>
    </div>
  );
};

export default ArcadeShooterArena;

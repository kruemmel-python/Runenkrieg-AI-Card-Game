
import React, { useState, useEffect } from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import Card from './Card';
import { HEROES } from '../constants';
import { generateGameStory } from '../services/geminiService';
import Spinner from './Spinner';

const GameBoard: React.FC<{ onSwitchView: (view: 'game' | 'training') => void }> = ({ onSwitchView }) => {
    const {
        playerHand, aiHand, playerTokens, aiTokens, playerHero, aiHero,
        playerCard, aiCard, weather, roundWinner, gamePhase, statusText, gameHistory,
        playCard, startGame
    } = useGameLogic();
    
    const [story, setStory] = useState('');
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);

    const finalWinner = playerTokens > aiTokens ? 'spieler' : aiTokens > playerTokens ? 'gegner' : 'unentschieden';

    useEffect(() => {
        if (gamePhase === 'gameOver' && gameHistory.length > 0) {
            setIsGeneratingStory(true);
            generateGameStory(gameHistory, finalWinner, playerHero, aiHero)
                .then(setStory)
                .finally(() => setIsGeneratingStory(false));
        }
    }, [gamePhase, gameHistory, finalWinner, playerHero, aiHero]);

    const renderPlayerInfo = (isPlayer: boolean) => {
        const heroName = isPlayer ? playerHero : aiHero;
        const tokens = isPlayer ? playerTokens : aiTokens;
        const heroData = HEROES[heroName];

        return (
            <div className="flex flex-col items-center bg-slate-800/50 p-3 rounded-lg shadow-inner">
                <div className="text-xl font-bold">{isPlayer ? "Du" : "KI"}</div>
                <div className="text-lg text-cyan-300">{heroName}</div>
                <div className="text-sm text-slate-400">({heroData.Bonus} Bonus auf {heroData.Element})</div>
                <div className="mt-2 text-2xl font-mono bg-slate-900 px-3 py-1 rounded">{tokens} Tokens</div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 space-y-4">
            {gamePhase === 'gameOver' && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 p-4 text-center">
                    <h2 className="text-5xl font-bold mb-4">Spiel Vorbei!</h2>
                    <p className="text-3xl mb-8">{statusText}</p>
                    {isGeneratingStory ? (
                        <div className="flex flex-col items-center">
                           <Spinner />
                           <p className="text-xl mt-4">Der Barde schreibt die Geschichte Eures Kampfes...</p>
                        </div>
                    ) : (
                        <div className="bg-slate-800 p-6 rounded-lg max-w-2xl max-h-[50vh] overflow-y-auto shadow-lg border border-slate-600">
                           <h3 className="text-2xl font-bold text-yellow-400 mb-4">Die Sage von Runenkrieg</h3>
                           <p className="text-lg whitespace-pre-wrap">{story}</p>
                        </div>
                    )}
                    <button onClick={startGame} className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-transform transform hover:scale-105">
                        Neues Spiel
                    </button>
                </div>
            )}

            {/* Top Bar: AI Info & Deck */}
            <div className="w-full flex justify-between items-center">
                {renderPlayerInfo(false)}
                <div className="flex items-center space-x-2 text-xl">
                   <span>{weather || 'Wetter wird bestimmt...'}</span>
                </div>
                <button onClick={() => onSwitchView('training')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-transform transform hover:scale-105">
                    KI Training
                </button>
            </div>
            
            {/* AI Hand */}
            <div className="flex justify-center items-center space-x-2 h-60">
                {aiHand.map((_, index) => <Card key={index} card={null} isFaceDown={true} />)}
            </div>
            
            {/* Played Cards Area */}
            <div className="flex items-center justify-around w-full h-72 bg-slate-800/30 rounded-lg p-4 my-4">
                 <div className="flex flex-col items-center">
                    <h3 className="text-lg mb-2">KI Karte</h3>
                    <Card card={aiCard} className={roundWinner === 'gegner' ? 'border-4 border-green-500 scale-110' : ''}/>
                 </div>
                 <div className="text-4xl font-bold animate-pulse">VS</div>
                 <div className="flex flex-col items-center">
                     <h3 className="text-lg mb-2">Deine Karte</h3>
                     <Card card={playerCard} className={roundWinner === 'spieler' ? 'border-4 border-green-500 scale-110' : ''}/>
                 </div>
            </div>

            {/* Player Hand */}
            <div className="flex justify-center items-center space-x-2 h-60">
                {playerHand.map((card, index) => (
                    <Card 
                        key={card.id} 
                        card={card} 
                        onClick={() => playCard(index)}
                        className={gamePhase === 'playerTurn' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
                    />
                ))}
            </div>

            {/* Bottom Bar: Player Info & Status */}
            <div className="w-full flex justify-between items-center">
                {renderPlayerInfo(true)}
                <div className="text-lg bg-black/50 px-4 py-2 rounded-md">{statusText}</div>
                <div className="w-48"></div> {/* Spacer */}
            </div>
        </div>
    );
};

export default GameBoard;

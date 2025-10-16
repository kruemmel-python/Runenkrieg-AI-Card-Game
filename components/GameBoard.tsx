
import React, { useState, useEffect } from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import Card from './Card';
import { HEROES } from '../constants';
import { generateGameStory } from '../services/geminiService';
import Spinner from './Spinner';

const GameBoard: React.FC<{ onSwitchView: (view: 'game' | 'training') => void }> = ({ onSwitchView }) => {
    const {
        playerHand,
        aiHand,
        playerTokens,
        aiTokens,
        playerHero,
        aiHero,
        playerCard,
        aiCard,
        weather,
        roundWinner,
        gamePhase,
        statusText,
        gameHistory,
        fusionSelectionId,
        playCard,
        startGame,
    } = useGameLogic();
    
    const [story, setStory] = useState('');
    const [storyNotice, setStoryNotice] = useState<string | null>(null);
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const [geminiEnabled, setGeminiEnabled] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useState('');

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const storedEnabled = window.localStorage.getItem('runenkrieg-gemini-enabled');
        const storedKey = window.localStorage.getItem('runenkrieg-gemini-api-key');

        if (storedEnabled !== null) {
            setGeminiEnabled(storedEnabled === 'true');
        }

        if (storedKey) {
            setGeminiApiKey(storedKey);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem('runenkrieg-gemini-enabled', geminiEnabled ? 'true' : 'false');

        const trimmedKey = geminiApiKey.trim();
        if (geminiEnabled && trimmedKey) {
            window.localStorage.setItem('runenkrieg-gemini-api-key', trimmedKey);
        } else {
            window.localStorage.removeItem('runenkrieg-gemini-api-key');
        }
    }, [geminiEnabled, geminiApiKey]);

    const finalWinner = playerTokens > aiTokens ? 'spieler' : aiTokens > playerTokens ? 'gegner' : 'unentschieden';

    useEffect(() => {
        if (gamePhase !== 'gameOver') {
            setStory('');
            setStoryNotice(null);
            setIsGeneratingStory(false);
            return;
        }

        if (gameHistory.length === 0) {
            setStory('');
            setStoryNotice(null);
            setIsGeneratingStory(false);
            return;
        }

        if (!geminiEnabled) {
            setStory('');
            setStoryNotice('Gemini ist deaktiviert. Aktiviere die Option, um eine Bardengeschichte zu erhalten.');
            setIsGeneratingStory(false);
            return;
        }

        const trimmedKey = geminiApiKey.trim();
        if (!trimmedKey) {
            setStory('');
            setStoryNotice('Bitte gib einen Gemini API-Schlüssel ein, um die Geschichte zu generieren.');
            setIsGeneratingStory(false);
            return;
        }

        setStoryNotice(null);
        setIsGeneratingStory(true);

        generateGameStory(gameHistory, finalWinner, playerHero, aiHero, trimmedKey)
            .then((generatedStory) => {
                setStory(generatedStory);
                if (!generatedStory.trim()) {
                    setStoryNotice('Gemini hat keine Geschichte zurückgegeben.');
                }
            })
            .catch((error) => {
                console.error('Fehler beim Generieren der Gemini-Geschichte:', error);
                setStory('');
                setStoryNotice('Beim Generieren der Geschichte ist ein Fehler aufgetreten. Bitte versuche es erneut.');
            })
            .finally(() => setIsGeneratingStory(false));
    }, [gamePhase, gameHistory, finalWinner, playerHero, aiHero, geminiEnabled, geminiApiKey]);

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
                           {storyNotice ? (
                               <p className="text-lg text-slate-300">{storyNotice}</p>
                           ) : (
                               <p className="text-lg whitespace-pre-wrap">{story}</p>
                           )}
                        </div>
                    )}
                    <button onClick={startGame} className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-transform transform hover:scale-105">
                        Neues Spiel
                    </button>
                </div>
            )}

            {/* Top Bar: AI Info & Deck */}
            <div className="w-full flex flex-wrap justify-between items-center gap-4">
                {renderPlayerInfo(false)}
                <div className="flex items-center space-x-2 text-xl">
                   <span>{weather || 'Wetter wird bestimmt...'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center space-x-2 text-sm bg-slate-800/60 px-3 py-2 rounded-md border border-slate-700">
                        <input
                            type="checkbox"
                            checked={geminiEnabled}
                            onChange={(event) => setGeminiEnabled(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-slate-200">Gemini aktivieren</span>
                    </label>
                    {geminiEnabled && (
                        <input
                            type="password"
                            value={geminiApiKey}
                            onChange={(event) => setGeminiApiKey(event.target.value)}
                            placeholder="Gemini API Key"
                            className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    )}
                    <button onClick={() => onSwitchView('training')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-transform transform hover:scale-105">
                        KI Training
                    </button>
                </div>
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
                {playerHand.map((card) => {
                    const isSelected = fusionSelectionId === card.id;
                    const fusionSelectionActive = fusionSelectionId !== null;
                    const disallowForFusion = fusionSelectionActive && !isSelected && !card.mechanics.includes('Fusion');
                    const disabled = gamePhase !== 'playerTurn' || disallowForFusion;

                    return (
                        <Card
                            key={card.id}
                            card={card}
                            onClick={() => playCard(card.id)}
                            isSelected={isSelected}
                            disabled={disabled}
                        />
                    );
                })}
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

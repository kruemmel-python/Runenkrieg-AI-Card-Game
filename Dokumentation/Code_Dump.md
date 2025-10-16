# Project Code Dump

This document contains a dump of all the files from the uploaded project.

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/.gitignore`

```
node_modules/
dist/
.DS_Store

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/App.tsx`

```typescript

import React, { useState } from 'react';
import GameBoard from './components/GameBoard';
import TrainingDashboard from './components/TrainingDashboard';

type View = 'game' | 'training';

function App() {
  const [currentView, setCurrentView] = useState<View>('game');

  const handleSwitchView = (view: View) => {
    setCurrentView(view);
  };

  return (
    <div className="App">
      {currentView === 'game' ? (
        <GameBoard onSwitchView={handleSwitchView} />
      ) : (
        <TrainingDashboard onSwitchView={handleSwitchView} />
      )}
    </div>
  );
}

export default App;

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/LICENSE`

```
MIT License

Copyright (c) 2025 Ralf Krümmel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/README.md`

```markdown
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1t6Xr49iSGzmR03HidiP00WQVhuzMmgZr

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/Spielbeschreibung.md`

```markdown
# Runenkrieg: Spielbeschreibung & KI-Leitfaden

Dieses Dokument erklärt die Regeln von Runenkrieg, wie das Spiel gespielt wird und wie die künstliche Intelligenz im Hintergrund funktioniert und von Ihnen trainiert werden kann.

## 1. Spielablauf

### Das Ziel
Dein Ziel in Runenkrieg ist es, die Lebenspunkte (Tokens) deines Gegners auf 0 zu reduzieren, bevor er deine auf 0 reduziert. Jeder Spieler startet mit 5 Tokens.

### Eine Runde spielen
1.  **Wähle eine Karte:** Du beginnst jede Runde. Wähle eine Karte aus deiner Hand, indem du darauf klickst. Jede Karte hat ein Element und eine Fähigkeit mit einer bestimmten Grundstärke.
2.  **KI kontert:** Die KI wird basierend auf deiner Wahl eine eigene Karte ausspielen. Ob sie dies zufällig tut oder eine strategische Entscheidung trifft, hängt davon ab, ob du sie trainiert hast.
3.  **Auswertung:** Die Stärke beider Karten wird verglichen, um einen Sieger für die Runde zu ermitteln. Die Gesamtstärke berechnet sich aus fünf Komponenten:
    *   **Grundwert:** Jede Fähigkeit hat eine feste Grundstärke (z.B. "Funke" hat Stärke 0, "Avatar" hat Stärke 13).
    *   **Wetter-Bonus:** Das in jeder Runde zufällig bestimmte Wetter kann bestimmte Elemente stärken oder schwächen. Eine Feuerkarte ist im Regen zum Beispiel weniger effektiv.
    *   **Element-Bonus:** Elemente haben Stärken und Schwächen gegeneinander (z.B. Wasser ist stark gegen Feuer und erhält einen Bonus, ist aber schwach gegen Luft).
    *   **Helden-Bonus:** Dein Held gibt dir einen Bonus, wenn du eine Karte spielst, die zu seinem Element gehört.
    *   **Moral-Bonus:** Du erhältst einen Stärkebonus, wenn du mehr Tokens besitzt als dein Gegner. Dieser Bonus wächst mit dem Vorsprung und simuliert die erhöhte Kampfmoral deiner Truppen.
4.  **Effekte & Nachziehen:** Die Siegerkarte der Runde löst ihren Element-Effekt aus, der meist die Token-Anzahl der Spieler beeinflusst. Danach ziehen beide Spieler eine Karte vom Stapel nach, solange dieser nicht leer ist.

### Spielende
Das Spiel endet, wenn eine der folgenden Bedingungen erfüllt ist:
*   Ein Spieler hat 0 oder weniger Tokens. Der Spieler mit mehr Tokens gewinnt das Spiel.
*   Beide Spieler haben keine Karten mehr auf der Hand und der Nachziehstapel ist leer. Der Spieler mit mehr Tokens gewinnt.
*   Bei exakt gleicher Token-Anzahl am Ende ist das Spiel ein Unentschieden.

Nach jedem abgeschlossenen Spiel fasst der epische Barde Gemini den Kampfverlauf in einer einzigartigen, spannenden Geschichte zusammen, um deine Heldentaten (oder deine Niederlage) zu verewigen.

## 2. Die KI: Simulation & Training

Die KI in Runenkrieg lernt durch einen Prozess, der von der Funktionsweise des menschlichen Gehirns inspiriert ist. Du kannst diesen Prozess im "KI Training"-Bereich selbst steuern und die KI zu einem besseren Gegner machen.

### Schritt 1: Simulation
*   **Zweck:** Um zu lernen, braucht die KI Erfahrungen in Form von Daten. Die Simulation ist eine Fabrik, die diese Daten erzeugt, indem sie Tausende von kompletten Spielen im Schnelldurchlauf durchspielt.
*   **Funktion:** Die Funktion `simulateGames` spielt die von dir gewählte Anzahl an Partien, wobei beide Spieler rein zufällige Züge machen. Jeder einzelne Zug und dessen Ergebnis (wer hat was gespielt, wie war das Wetter, wer hat gewonnen, wie war der Token-Stand) wird als Datensatz für das spätere Training gespeichert.
*   **Ergebnis:** Eine riesige Sammlung von Spieldaten, die als Trainingsgrundlage für die KI dient. Je mehr Simulationen, desto besser die Datenbasis.

### Schritt 2: Training (Der "BioVision"-Ansatz)
*   **Zweck:** Die KI analysiert die gesammelten Spieldaten, um Muster zu erkennen und eine Strategie zu entwickeln. Sie lernt, welche Karten in welchen Situationen die besten Antworten sind.
*   **Was wird trainiert?** Wir trainieren keine undurchsichtige "Black Box"-KI. Stattdessen verwenden wir ein effizientes, **biologisch inspiriertes Modell**, das Aspekte der visuellen Verarbeitung im Gehirn nachahmt. Man nennt diesen Ansatz **Sparse Dictionary Learning**.

#### Wie funktioniert das Training?
1.  **Merkmale extrahieren:** Zuerst wird jeder Spielzug in eine für den Computer verständliche, numerische Sprache übersetzt – einen sogenannten "Feature-Vektor". Dieser Vektor enthält alle relevanten Informationen: welche Karten gespielt wurden, die Token-Anzahl, das Wetter usw.

2.  **Muster-Wörterbuch lernen (Dictionary Learning):** Die KI lernt nun ein "Wörterbuch" aus fundamentalen Spielmustern (sogenannten Atomen). Man kann sich das so vorstellen: Anstatt sich jeden einzelnen der Tausenden Spielzüge zu merken, lernt die KI die grundlegenden "Bausteine" eines guten oder schlechten Zuges.

3.  **Spärliche Aktivierung (Sparsity):** Das Besondere an diesem Modell ist die "Spärlichkeit" (Sparsity). Wenn die KI einen neuen, unbekannten Spielzug sieht, versucht sie nicht, ihn mit allen gelernten Mustern abzugleichen. Stattdessen beschreibt sie den Zug durch eine **Kombination von nur sehr wenigen** Mustern aus ihrem Wörterbuch. Dies ist inspiriert davon, wie im Gehirn für eine bestimmte Aufgabe nur eine kleine Teilmenge von Neuronen gleichzeitig aktiv ist. Dieser Ansatz ist extrem ressourcenschonend und effizient.

4.  **k-Winner-Take-All (k-WTA):** Dieser Mechanismus sorgt für die Spärlichkeit. Von allen möglichen Mustern im Wörterbuch werden nur die `k` (z.B. 16) relevantesten zur Beschreibung der Situation herangezogen. Alle anderen werden ignoriert.

5.  **Entscheidung treffen:** Auf Basis dieser "spärlichen" Repräsentation der Spielsituation trifft ein einfacher Klassifikator die finale Entscheidung: Welche Karte aus der eigenen Hand führt gegen die gespielte Karte des Gegners, **unter Berücksichtigung des aktuellen Wetters**, mit der höchsten statistischen Wahrscheinlichkeit zum Sieg?

Wenn du auf "Trainiere KI" klickst, durchläuft die KI diesen Prozess. Anschließend nutzt sie das neu erlernte Modell, um ihre Züge zu wählen, anstatt nur zufällig eine Karte zu spielen.
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/components/Card.tsx`

```typescript
import React, { useState } from 'react';
import { Card as CardType } from '../types';
import { ELEMENT_COLORS, ABILITIES, ELEMENT_EFFECTS } from '../constants';

interface CardProps {
  card: CardType | null;
  isFaceDown?: boolean;
  onClick?: () => void;
  className?: string;
}

const Card: React.FC<CardProps> = ({ card, isFaceDown = false, onClick, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (isFaceDown) {
    return (
      <div className={`w-36 h-52 sm:w-40 sm:h-56 rounded-xl bg-slate-700 border-2 border-slate-500 shadow-lg flex items-center justify-center ${className} transition-transform duration-300`}>
        <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-4xl text-slate-500">
         룬
        </div>
      </div>
    );
  }
  
  if (!card) {
     return <div className={`w-36 h-52 sm:w-40 sm:h-56 rounded-xl bg-slate-800/50 border-2 border-dashed border-slate-600 ${className}`} />;
  }

  const { element, wert } = card;
  const colors = ELEMENT_COLORS[element] || { from: 'from-gray-500', to: 'to-gray-400', icon: '❓' };

  return (
    <div
      className={`relative w-36 h-52 sm:w-40 sm:h-56 p-2 rounded-xl bg-gradient-to-br ${colors.from} ${colors.to} text-black border-2 border-white/50 shadow-xl flex flex-col justify-between cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300 ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div 
            className="absolute bottom-full mb-2 w-44 -left-2 p-2 bg-slate-900 border border-slate-600 rounded-lg shadow-lg z-20 text-white text-xs animate-fade-in-fast" 
            style={{ pointerEvents: 'none' }}
        >
            <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-base text-cyan-400">{wert}</span>
                <span className="font-bold text-base text-yellow-400">Stärke: {ABILITIES.indexOf(wert)}</span>
            </div>
            <p className="mt-1 text-slate-300">{ELEMENT_EFFECTS[element]}</p>
        </div>
      )}

      <div className="flex justify-between items-start">
        <span className="text-xl font-bold break-words pr-1">{wert}</span>
        <span className="text-4xl">{colors.icon}</span>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold tracking-wider">{element}</h3>
      </div>
      <div className="flex justify-between items-end">
        <span className="text-4xl transform -scale-x-100">{colors.icon}</span>
        <span className="text-xl font-bold break-words pl-1 text-right">{wert}</span>
      </div>
    </div>
  );
};

export default Card;
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/components/GameBoard.tsx`

```typescript

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

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/components/Spinner.tsx`

```typescript

import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
  );
};

export default Spinner;

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/components/TrainingDashboard.tsx`

```typescript

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
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
                </div>
                {trainingAnalysis.bestContext && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-lg text-slate-200">
                        <p className="font-semibold text-white mb-2">Stärkstes Szenario</p>
                        <p>
                            Spielerkarte <span className="text-purple-300">{trainingAnalysis.bestContext.playerCard}</span> bei Wetter{' '}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.weather}</span> wird am besten mit{' '}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.aiCard}</span> beantwortet.
                        </p>
                        <p className="mt-2">
                            Helden-Duell:{' '}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.playerHero}</span> vs.{' '}
                            <span className="text-purple-300">{trainingAnalysis.bestContext.aiHero}</span>
                            {' '}bei einer Token-Differenz von{' '}
                            <span className="text-purple-300">{formatTokenDelta(trainingAnalysis.bestContext.tokenDelta)}</span>{' '}
                            {describeTokenAdvantage(trainingAnalysis.bestContext.tokenDelta)}.
                        </p>
                        <p>
                            Siegquote: <span className="text-green-400">{formatPercent(trainingAnalysis.bestContext.winRate)}</span> auf Grundlage von{' '}
                            {formatNumber(trainingAnalysis.bestContext.observations)} Beobachtungen.
                        </p>
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

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/constants.ts`

```typescript
import { ElementType } from './types';

export const ELEMENTS = ["Feuer", "Wasser", "Erde", "Luft", "Blitz", "Eis", "Magie"] as const;

export const ABILITIES = [
    "Funke",      // Stärke 0
    "Strahl",     // Stärke 1
    "Flamme",     // Stärke 2
    "Glut",       // Stärke 3
    "Feuerball",  // Stärke 4
    "Inferno",    // Stärke 5
    "Nova",       // Stärke 6
    "Supernova",  // Stärke 7
    "Apokalypse", // Stärke 8
    "Weltenbrand",// Stärke 9
    "Akolyth",    // Stärke 10 (Bube)
    "Priesterin", // Stärke 11 (Dame)
    "Elementar",  // Stärke 12 (Koenig)
    "Avatar"      // Stärke 13 (Ass)
] as const;


export const ELEMENT_HIERARCHIE: Record<ElementType, Partial<Record<ElementType, number>>> = {
    "Wasser": {"Feuer": 3, "Erde": 1, "Luft": -3, "Blitz": -3, "Eis": 3},
    "Feuer": {"Erde": 3, "Luft": 1, "Wasser": -3, "Eis": 1, "Blitz": 1},
    "Erde": {"Luft": 3, "Wasser": -1, "Feuer": -3, "Blitz": 3, "Eis": 1},
    "Luft": {"Wasser": 3, "Erde": -1, "Feuer": -3, "Eis": 3, "Blitz": -1},
    "Blitz": {"Wasser": 3, "Erde": 1, "Feuer": 1, "Luft": -3, "Eis": -1},
    "Eis": {"Feuer": 3, "Erde": 1, "Wasser": -3, "Luft": 1, "Blitz": 3},
    "Magie": {"Feuer": 1, "Wasser": 1, "Erde": 1, "Luft": 1, "Blitz": 2, "Eis": 2},
};

export const ELEMENT_EFFECTS: Record<ElementType, string> = {
    "Feuer": "Effekt bei Sieg: -1 Gegnertoken.",
    "Wasser": "Effekt bei Sieg: +1 Eigene Tokens, -1 Gegnertoken.",
    "Erde": "Effekt bei Sieg: +1 Eigene Tokens.",
    "Luft": "Effekt bei Sieg: +2 Eigene Tokens.",
    "Blitz": "Effekt bei Sieg: +1 Zusätzlicher Token.",
    "Eis": "Effekt bei Sieg: -1 Gegnertoken.",
    "Magie": "Kein direkter Kampfeffekt. Beeinflusst das Spiel auf andere Weise.",
};

// FIX: Removed explicit type annotation on HEROES that caused a circular dependency.
// By using 'as const', TypeScript can infer the precise type, which is then used 
// in types.ts to create the HeroName type without a circular reference.
export const HEROES = {
    "Drache": {"Element": "Feuer", "Bonus": 2},
    "Zauberer": {"Element": "Magie", "Bonus": 3},
} as const;

// FIX: Removed explicit type annotation on WEATHER_EFFECTS that caused a circular dependency.
// 'as const' allows for type inference, breaking the circular reference with WeatherType.
export const WEATHER_EFFECTS = {
    "Regen": {"Wasser": 1, "Feuer": -1},
    "Windsturm": {"Luft": 2, "Erde": -1},
    "Erdbeben": {}
} as const;

export const START_TOKENS = 5;
export const HAND_SIZE = 4;

export const ELEMENT_COLORS: Record<ElementType, { from: string, to: string, icon: string }> = {
    "Feuer": { from: 'from-red-500', to: 'to-orange-400', icon: '🔥' },
    "Wasser": { from: 'from-blue-500', to: 'to-cyan-400', icon: '💧' },
    "Erde": { from: 'from-green-500', to: 'to-lime-400', icon: '🌱' },
    "Luft": { from: 'from-yellow-200', to: 'to-gray-100', icon: '🌬️' },
    "Blitz": { from: 'from-yellow-400', to: 'to-yellow-300', icon: '⚡' },
    "Eis": { from: 'from-cyan-200', to: 'to-blue-300', icon: '🧊' },
    "Magie": { from: 'from-purple-500', to: 'to-indigo-400', icon: '✨' },
};
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/hooks/useGameLogic.ts`

```typescript
import { useState, useCallback, useEffect } from 'react';
import { Card, ElementType, GameHistoryEntry, HeroName, ValueType, WeatherType, Winner } from '../types';
import { 
    ELEMENTS, 
    ABILITIES, 
    HAND_SIZE, 
    START_TOKENS, 
    HEROES, 
    WEATHER_EFFECTS,
    ELEMENT_HIERARCHIE 
} from '../constants';
import { chooseCard } from '../services/aiService';

export const useGameLogic = () => {
    const [deck, setDeck] = useState<Card[]>([]);
    const [playerHand, setPlayerHand] = useState<Card[]>([]);
    const [aiHand, setAiHand] = useState<Card[]>([]);
    const [playerTokens, setPlayerTokens] = useState(START_TOKENS);
    const [aiTokens, setAiTokens] = useState(START_TOKENS);
    const [playerHero, setPlayerHero] = useState<HeroName>('Drache');
    const [aiHero, setAiHero] = useState<HeroName>('Zauberer');
    
    const [playerCard, setPlayerCard] = useState<Card | null>(null);
    const [aiCard, setAiCard] = useState<Card | null>(null);
    const [weather, setWeather] = useState<WeatherType | null>(null);
    const [roundWinner, setRoundWinner] = useState<Winner | null>(null);
    const [gamePhase, setGamePhase] = useState<'start' | 'playerTurn' | 'evaluation' | 'gameOver'>('start');
    const [statusText, setStatusText] = useState('Beginne ein neues Spiel!');
    const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);

    const createDeck = useCallback(() => {
        const newDeck: Card[] = [];
        ELEMENTS.forEach(element => {
            ABILITIES.forEach(wert => {
                newDeck.push({ element, wert, id: `${element}-${wert}` });
            });
        });
        // Fisher-Yates shuffle
        for (let i = newDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
        }
        return newDeck;
    }, []);

    const startGame = useCallback(() => {
        const newDeck = createDeck();
        const heroNames = Object.keys(HEROES) as HeroName[];
        
        setPlayerHero(heroNames[Math.floor(Math.random() * heroNames.length)]);
        setAiHero(heroNames[Math.floor(Math.random() * heroNames.length)]);
        
        setPlayerHand(newDeck.slice(0, HAND_SIZE));
        setAiHand(newDeck.slice(HAND_SIZE, HAND_SIZE * 2));
        setDeck(newDeck.slice(HAND_SIZE * 2));
        
        setPlayerTokens(START_TOKENS);
        setAiTokens(START_TOKENS);
        setPlayerCard(null);
        setAiCard(null);
        setRoundWinner(null);
        setGameHistory([]);
        setGamePhase('playerTurn');
        setStatusText('Du bist am Zug. Wähle eine Karte.');
    }, [createDeck]);

    const calculateTotalValue = (
        ownCard: Card, 
        opponentCard: Card, 
        hero: HeroName, 
        ownTokens: number,
        opponentTokens: number,
        currentWeather: WeatherType
    ) => {
        const baseValue = ABILITIES.indexOf(ownCard.wert);
        const weatherEffectBonus = (WEATHER_EFFECTS[currentWeather] as Record<ElementType, number>)[ownCard.element] || 0;
        const elementBonus = ELEMENT_HIERARCHIE[ownCard.element]?.[opponentCard.element] ?? 0;
        const heroBonus = HEROES[hero].Element === ownCard.element ? HEROES[hero].Bonus : 0;
        const moraleBonus = Math.min(4, Math.floor(Math.max(0, ownTokens - opponentTokens) / 2));
        return baseValue + weatherEffectBonus + elementBonus + heroBonus + moraleBonus;
    };

    const playCard = useCallback((cardIndex: number) => {
        if (gamePhase !== 'playerTurn' || cardIndex >= playerHand.length) return;

        const playedPlayerCard = playerHand[cardIndex];
        setPlayerCard(playedPlayerCard);

        const remainingPlayerHand = playerHand.filter((_, i) => i !== cardIndex);
        setPlayerHand(remainingPlayerHand);
        
        const newWeather = Object.keys(WEATHER_EFFECTS)[Math.floor(Math.random() * Object.keys(WEATHER_EFFECTS).length)] as WeatherType;
        setWeather(newWeather);
        
        const gameState = { playerTokens, aiTokens, weather: newWeather, playerHero, aiHero };
        const playedAiCard = chooseCard(playedPlayerCard, aiHand, gameState);
        setAiCard(playedAiCard);
        
        const remainingAiHand = aiHand.filter(c => c.id !== playedAiCard.id);
        setAiHand(remainingAiHand);

        setGamePhase('evaluation');

        // --- Evaluation Logic ---
        const playerTotal = calculateTotalValue(playedPlayerCard, playedAiCard, playerHero, playerTokens, aiTokens, newWeather);
        const aiTotal = calculateTotalValue(playedAiCard, playedPlayerCard, aiHero, aiTokens, playerTokens, newWeather);

        let winner: Winner;
        if (playerTotal > aiTotal) winner = "spieler";
        else if (aiTotal > playerTotal) winner = "gegner";
        else winner = "unentschieden";
        
        setRoundWinner(winner);

        let newPlayerTokens = playerTokens;
        let newAiTokens = aiTokens;
        const winnerCard = winner === 'spieler' ? playedPlayerCard : playedAiCard;

        if(winner !== 'unentschieden') {
            switch(winnerCard.element){
                case "Feuer": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
                case "Wasser": winner === "spieler" ? (newPlayerTokens++, newAiTokens--) : (newAiTokens++, newPlayerTokens--); break;
                case "Erde": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
                case "Luft": winner === "spieler" ? newPlayerTokens += 2 : newAiTokens += 2; break;
                case "Blitz": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
                case "Eis": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
            }
        }
        
        newPlayerTokens = Math.max(0, newPlayerTokens);
        newAiTokens = Math.max(0, newAiTokens);

        setPlayerTokens(newPlayerTokens);
        setAiTokens(newAiTokens);

        setGameHistory(prev => [...prev, {
            round: prev.length + 1,
            playerCard: playedPlayerCard,
            aiCard: playedAiCard,
            weather: newWeather,
            winner,
            playerTokens: newPlayerTokens,
            aiTokens: newAiTokens
        }]);

        setStatusText(`Runde ${gameHistory.length + 1}: ${winner} gewinnt den Stich!`);

        setTimeout(() => {
            let tempDeck = [...deck];
            let tempPlayerHand = [...remainingPlayerHand];
            let tempAiHand = [...remainingAiHand];

            if (tempPlayerHand.length < HAND_SIZE && tempDeck.length > 0) {
                tempPlayerHand.push(tempDeck.pop()!);
            }
            if (tempAiHand.length < HAND_SIZE && tempDeck.length > 0) {
                tempAiHand.push(tempDeck.pop()!);
            }

            setDeck(tempDeck);
            setPlayerHand(tempPlayerHand);
            setAiHand(tempAiHand);
            setPlayerCard(null);
            setAiCard(null);

            if (newPlayerTokens <= 0 || newAiTokens <= 0 || (tempPlayerHand.length === 0 && tempAiHand.length === 0)) {
                setGamePhase('gameOver');
                const finalWinner = newPlayerTokens > newAiTokens ? "spieler" : newAiTokens > newPlayerTokens ? "gegner" : "unentschieden";
                setStatusText(`Spiel vorbei! ${finalWinner === 'unentschieden' ? 'Unentschieden' : `${finalWinner} hat gewonnen!`}`);
            } else {
                setGamePhase('playerTurn');
                setStatusText('Nächste Runde. Wähle eine Karte.');
            }
        }, 3000);

    }, [gamePhase, playerHand, aiHand, deck, playerTokens, aiTokens, playerHero, aiHero, gameHistory.length]);

    useEffect(() => {
        if (gamePhase === 'start') {
            startGame();
        }
    }, [gamePhase, startGame]);

    return {
        playerHand, aiHand, playerTokens, aiTokens, playerHero, aiHero,
        playerCard, aiCard, weather, roundWinner, gamePhase, statusText, gameHistory,
        playCard, startGame
    };
};
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/index.html`

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Runenkrieg KI Trainingszentrum</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      :root {
        color-scheme: dark;
      }

      body {
        min-height: 100vh;
      }
    </style>
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/index.tsx`

```typescript

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/metadata.json`

```json
{
  "name": "Runenkrieg AI Card Game",
  "description": "A React-based card game where players face an AI opponent. The application includes a simulation and training module for the game AI. At the end of each game, Gemini generates a unique, exciting story summarizing the match.",
  "requestFramePermissions": []
}
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/package.json`

```json
{
  "name": "runenkrieg-ai-card-game",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@google/genai": "^1.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/services/aiService.ts`

```typescript

import { Card, TrainedModel } from '../types';

let trainedModel: TrainedModel | null = null;

export function setTrainedModel(model: TrainedModel) {
    trainedModel = model;
}

export function isAiTrained(): boolean {
    return trainedModel !== null;
}

export function chooseCard(playerCard: Card, aiHand: Card[], gameState: any): Card {
    if (trainedModel) {
        return trainedModel.predict(playerCard, aiHand, gameState);
    }
    // Fallback: simple random choice if not trained
    return aiHand[Math.floor(Math.random() * aiHand.length)];
}

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/services/geminiService.ts`

```typescript

import { GoogleGenAI } from "@google/genai";
import { GameHistoryEntry, Winner, HeroName } from "../types";

const envKey = (
  import.meta.env.VITE_GEMINI_API_KEY ??
  import.meta.env.VITE_API_KEY ??
  ""
).trim();
let cachedApiKey = envKey.length > 0 ? envKey : undefined;
let client: GoogleGenAI | null = cachedApiKey ? new GoogleGenAI({ apiKey: cachedApiKey }) : null;

if (!cachedApiKey) {
  console.warn("Gemini API key not set. Gemini features are optional and currently disabled.");
}

function getClient(apiKeyOverride?: string): GoogleGenAI | null {
  const normalizedOverride = apiKeyOverride?.trim();
  const effectiveKey = normalizedOverride || cachedApiKey;

  if (!effectiveKey) {
    return null;
  }

  if (!client || cachedApiKey !== effectiveKey) {
    client = new GoogleGenAI({ apiKey: effectiveKey });
    cachedApiKey = effectiveKey;
  }

  return client;
}

export async function generateGameStory(
  history: GameHistoryEntry[],
  finalWinner: Winner,
  playerHero: HeroName,
  aiHero: HeroName,
  apiKeyOverride?: string
): Promise<string> {
    const geminiClient = getClient(apiKeyOverride);
    if (!geminiClient) {
        return "Gemini ist deaktiviert oder nicht konfiguriert.";
    }

    const gameFlow = history.map(entry => 
        `Runde ${entry.round}: Spieler (${entry.playerCard.element} ${entry.playerCard.wert}) vs KI (${entry.aiCard.element} ${entry.aiCard.wert}). Wetter: ${entry.weather}. Gewinner: ${entry.winner}. Tokens: Spieler ${entry.playerTokens}, KI ${entry.aiTokens}.`
    ).join('\n');

    const winnerText = finalWinner === 'spieler' ? 'der tapfere Spieler' : (finalWinner === 'gegner' ? 'die listige KI' : 'niemand, es war ein Unentschieden');

    const prompt = `
Du bist ein epischer Barde in der Welt von Runenkrieg. Deine Aufgabe ist es, eine kurze, spannende und aufregende Geschichte über eine gerade beendete Schlacht zu schreiben.

Hier sind die Details der Schlacht:
- Held des Spielers: ${playerHero}
- Held der KI: ${aiHero}
- Der endgültige Sieger der Schlacht war: ${winnerText}.

Hier ist der detaillierte Verlauf der Schlacht, Runde für Runde:
${gameFlow}

Schreibe nun eine fesselnde Zusammenfassung dieser Schlacht. Beginne dramatisch, beschreibe einen Höhepunkt und ende mit dem glorreichen Sieg oder der tragischen Niederlage. Halte die Geschichte kurz, aber packend. Sprich den Spieler direkt mit "Du" an, wenn du über seine Aktionen schreibst.
`;

    try {
        const response = await geminiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error generating story with Gemini:", error);
        return "Ein Fehler ist aufgetreten, als die Geschichte des Kampfes geschrieben wurde. Der Barde ist heiser.";
    }
}

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/services/trainingService.ts`

```typescript
import { Card, ElementType, RoundResult, TrainedModel, ValueType, WeatherType, Winner, HeroName, TrainingAnalysis } from '../types';
import { ELEMENTS, ABILITIES, WEATHER_EFFECTS, ELEMENT_HIERARCHIE, HEROES } from '../constants';

// --- Simulation Logic (now mirrors real game logic) ---

// Helper to calculate value in simulation, mirroring the main game logic
function calculateTotalValueInSim(
    ownCard: Card,
    opponentCard: Card,
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    currentWeather: WeatherType
): number {
    const baseValue = ABILITIES.indexOf(ownCard.wert);
    const weatherEffectBonus = (WEATHER_EFFECTS[currentWeather] as Record<ElementType, number>)[ownCard.element] || 0;
    const elementBonus = ELEMENT_HIERARCHIE[ownCard.element]?.[opponentCard.element] ?? 0;
    const heroBonus = HEROES[hero].Element === ownCard.element ? HEROES[hero].Bonus : 0;
    const moraleBonus = Math.min(4, Math.floor(Math.max(0, ownTokens - opponentTokens) / 2));
    return baseValue + weatherEffectBonus + elementBonus + heroBonus + moraleBonus;
}

// Helper to apply element effects in simulation
function applyElementEffect(winner: Winner, winnerCard: Card, pTokens: number, aTokens: number): [number, number] {
    let newPlayerTokens = pTokens;
    let newAiTokens = aTokens;
    if (winner !== 'unentschieden') {
        switch (winnerCard.element) {
            case "Feuer": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
            case "Wasser": winner === "spieler" ? (newPlayerTokens++, newAiTokens--) : (newAiTokens++, newPlayerTokens--); break;
            case "Erde": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
            case "Luft": winner === "spieler" ? newPlayerTokens += 2 : newAiTokens += 2; break;
            case "Blitz": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
            case "Eis": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
        }
    }
    return [newPlayerTokens, newAiTokens];
}


function determineWinnerInSim(playerCard: Card, aiCard: Card, playerHero: HeroName, aiHero: HeroName, pTokens: number, aTokens: number, weather: WeatherType): Winner {
    const playerTotal = calculateTotalValueInSim(playerCard, aiCard, playerHero, pTokens, aTokens, weather);
    const aiTotal = calculateTotalValueInSim(aiCard, playerCard, aiHero, aTokens, pTokens, weather);

    if (playerTotal > aiTotal) return "spieler";
    if (aiTotal > playerTotal) return "gegner";
    return "unentschieden";
}

function generateDeck(): Card[] {
    const deck: Card[] = [];
    for (const element of ELEMENTS) {
        for (const wert of ABILITIES) {
            deck.push({ element, wert, id: `${element}-${wert}` });
        }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}


export function simulateGames(numGames: number): RoundResult[] {
    const allData: RoundResult[] = [];
    const heroNames = Object.keys(HEROES) as HeroName[];

    for (let i = 0; i < numGames; i++) {
        const deck = generateDeck();
        let playerHand = deck.slice(0, 4);
        let aiHand = deck.slice(4, 8);
        let talon = deck.slice(8);
        let playerTokens = 5;
        let aiTokens = 5;
        
        // Random heroes for each simulated game
        const playerHero = heroNames[Math.floor(Math.random() * heroNames.length)];
        const aiHero = heroNames[Math.floor(Math.random() * heroNames.length)];

        while (playerTokens > 0 && aiTokens > 0 && playerHand.length > 0 && aiHand.length > 0) {
            const weather = Object.keys(WEATHER_EFFECTS)[Math.floor(Math.random() * Object.keys(WEATHER_EFFECTS).length)] as WeatherType;
            
            const playerCard = playerHand.splice(Math.floor(Math.random() * playerHand.length), 1)[0];
            const aiCard = aiHand.splice(Math.floor(Math.random() * aiHand.length), 1)[0];

            const prePlayerTokens = playerTokens;
            const preAiTokens = aiTokens;

            const winner = determineWinnerInSim(playerCard, aiCard, playerHero, aiHero, playerTokens, aiTokens, weather);

            // UPDATED: Apply accurate element effects
            const winnerCard = winner === 'spieler' ? playerCard : aiCard;
            [playerTokens, aiTokens] = applyElementEffect(winner, winnerCard, playerTokens, aiTokens);
            
            playerTokens = Math.max(0, playerTokens);
            aiTokens = Math.max(0, aiTokens);

            allData.push({
                spieler_karte: `${playerCard.element} ${playerCard.wert}`,
                gegner_karte: `${aiCard.element} ${aiCard.wert}`,
                spieler_token_vorher: prePlayerTokens,
                gegner_token_vorher: preAiTokens,
                spieler_token: playerTokens,
                gegner_token: aiTokens,
                wetter: weather,
                spieler_held: playerHero,
                gegner_held: aiHero,
                gewinner: winner,
            });

            if (talon.length > 0 && playerHand.length < 4) playerHand.push(talon.pop()!);
            if (talon.length > 0 && aiHand.length < 4) aiHand.push(talon.pop()!);
        }
    }
    return allData;
}


// --- Training Logic (now context-aware) ---

// This builds a model: for each (player card + weather), what AI card has the best win rate?
export function trainModel(simulationData: RoundResult[]): TrainedModel {
    const modelData = new Map<string, Map<string, { wins: number; total: number }>>();

    for (const round of simulationData) {
        // UPDATED: Context-aware key
        const tokenDelta = round.spieler_token_vorher - round.gegner_token_vorher;
        const clampedDelta = Math.max(-5, Math.min(5, tokenDelta));
        const heroMatchupKey = `${round.spieler_held}vs${round.gegner_held}`;
        const contextKey = `${round.spieler_karte}|${round.wetter}|${heroMatchupKey}|delta:${clampedDelta}`;
        const aiCardKey = round.gegner_karte;

        if (!modelData.has(contextKey)) {
            modelData.set(contextKey, new Map());
        }
        const aiCardMap = modelData.get(contextKey)!;

        if (!aiCardMap.has(aiCardKey)) {
            aiCardMap.set(aiCardKey, { wins: 0, total: 0 });
        }
        const stats = aiCardMap.get(aiCardKey)!;

        stats.total += 1;
        if (round.gewinner === 'gegner') {
            stats.wins += 1;
        }
    }

    let contextsWithSolidData = 0;
    let winRateSum = 0;
    let contextsWithBestCard = 0;
    let bestContext: TrainingAnalysis['bestContext'] | undefined = undefined;

    for (const [contextKey, aiCardMap] of modelData.entries()) {
        let bestCardKey: string | null = null;
        let bestStats: { wins: number; total: number } | null = null;
        let bestWinRate = -1;

        for (const [cardKey, stats] of aiCardMap.entries()) {
            if (stats.total === 0) continue;
            const winRate = stats.wins / stats.total;
            if (winRate > bestWinRate) {
                bestWinRate = winRate;
                bestCardKey = cardKey;
                bestStats = stats;
            }
        }

        if (bestStats && bestCardKey) {
            contextsWithBestCard += 1;
            winRateSum += bestWinRate;
            if (bestStats.total >= 5) {
                contextsWithSolidData += 1;
            }

            if (!bestContext || bestWinRate > bestContext.winRate) {
                const [playerCard, weatherString, heroMatchupString, deltaString] = contextKey.split('|');
                const weather = weatherString as WeatherType;
                const [playerHero, aiHero] = heroMatchupString.split('vs') as [HeroName, HeroName];
                const tokenDelta = Number(deltaString.replace('delta:', ''));
                bestContext = {
                    playerCard,
                    weather,
                    playerHero,
                    aiHero,
                    tokenDelta,
                    aiCard: bestCardKey,
                    winRate: bestWinRate,
                    observations: bestStats.total,
                };
            }
        }
    }

    const totalContexts = modelData.size;
    const contextsNeedingData = Math.max(0, totalContexts - contextsWithSolidData);
    const averageBestWinRate = contextsWithBestCard > 0 ? winRateSum / contextsWithBestCard : 0;

    const analysis: TrainingAnalysis = {
        totalContexts,
        contextsWithSolidData,
        contextsNeedingData,
        averageBestWinRate,
        bestContext,
    };

    const predict = (playerCard: Card, aiHand: Card[], gameState: any): Card => {
        // UPDATED: Use weather from gameState for context
        const tokenDelta = (gameState.playerTokens ?? 0) - (gameState.aiTokens ?? 0);
        const clampedDelta = Math.max(-5, Math.min(5, tokenDelta));
        const heroMatchupKey = `${gameState.playerHero}vs${gameState.aiHero}`;
        const contextKey = `${playerCard.element} ${playerCard.wert}|${gameState.weather}|${heroMatchupKey}|delta:${clampedDelta}`;
        const possiblePlays = modelData.get(contextKey);

        if (!possiblePlays || aiHand.length === 0) {
            // Fallback to highest value card if no data or no cards
            const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
            return sortedHand[0] || aiHand[Math.floor(Math.random() * aiHand.length)];
        }

        let bestCard: Card | null = null;
        let bestWinRate = -1;

        for (const cardInHand of aiHand) {
            const cardInHandKey = `${cardInHand.element} ${cardInHand.wert}`;
            const stats = possiblePlays.get(cardInHandKey);
            
            if (stats && stats.total > 0) {
                const winRate = stats.wins / stats.total;
                if (winRate > bestWinRate) {
                    bestWinRate = winRate;
                    bestCard = cardInHand;
                }
            }
        }
        
        // If no card in hand has data, play one with highest value
        if (!bestCard) {
             const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
             return sortedHand[0];
        }

        return bestCard;
    };

    return { predict, analysis };
}
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "types": [
      "node"
    ],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/types.ts`

```typescript
import { ELEMENTS, ABILITIES, HEROES, WEATHER_EFFECTS } from './constants';

export type ElementType = typeof ELEMENTS[number];
export type ValueType = typeof ABILITIES[number];
export type HeroName = keyof typeof HEROES;
export type WeatherType = keyof typeof WEATHER_EFFECTS;
export type Winner = "spieler" | "gegner" | "unentschieden";

export interface Card {
  element: ElementType;
  wert: ValueType;
  id: string;
}

export interface Player {
  hand: Card[];
  tokens: number;
  hero: HeroName;
}

export interface RoundResult {
  spieler_karte: string;
  gegner_karte: string;
  spieler_token_vorher: number;
  gegner_token_vorher: number;
  spieler_token: number;
  gegner_token: number;
  wetter: WeatherType;
  spieler_held: HeroName;
  gegner_held: HeroName;
  gewinner: Winner;
}

export interface SimulationAnalysis {
  totalRounds: number;
  playerWins: number;
  aiWins: number;
  draws: number;
  playerWinRate: number;
  aiWinRate: number;
  averagePlayerTokens: number;
  averageAiTokens: number;
  mostCommonPlayerCard: string | null;
  mostCommonAiCard: string | null;
  mostCommonWeather: WeatherType | null;
  mostCommonPlayerHero: HeroName | null;
  mostCommonAiHero: HeroName | null;
}

export interface TrainingAnalysis {
  totalContexts: number;
  contextsWithSolidData: number;
  contextsNeedingData: number;
  averageBestWinRate: number;
  bestContext?: {
    playerCard: string;
    weather: WeatherType;
    playerHero: HeroName;
    aiHero: HeroName;
    tokenDelta: number;
    aiCard: string;
    winRate: number;
    observations: number;
  };
}

export interface TrainedModel {
  predict: (playerCard: Card, aiHand: Card[], gameState: any) => Card;
  analysis: TrainingAnalysis;
}

export interface GameHistoryEntry {
  round: number;
  playerCard: Card;
  aiCard: Card;
  weather: WeatherType;
  winner: Winner;
  playerTokens: number;
  aiTokens: number;
}
```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/vite.config.ts`

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

```

---

## `Runenkrieg-AI-Card-Game-codex-add-simulations-analysis-and-training-analysis/AI_DOKU.md`

```markdown
# KI-System-Dokumentation für Runenkrieg

## Einleitung

Dieses Dokument beschreibt das KI-System des Runenkrieg-Kartenspiels, insbesondere wie Simulationen für Trainingseinheiten ablaufen und wie das KI-Training selbst funktioniert. Ziel ist es, ein Verständnis für die Mechanismen zu schaffen, die es der KI ermöglichen, strategische Entscheidungen zu treffen und sich kontinuierlich zu verbessern.

Das Runenkrieg-Kartenspiel ist ein rundenbasiertes Strategiespiel, bei dem Spieler Karten ausspielen, um ihre Gegner zu besiegen. Die KI muss in der Lage sein, die Spielregeln zu verstehen, den Spielzustand zu analysieren und optimale Züge auszuwählen.

## Simulationsablauf für Trainingseinheiten

### Was ist die Simulation?

Die Simulation ist ein Kernbestandteil des KI-Trainingsprozesses. Sie ermöglicht es, eine große Anzahl von Spielen in einer kontrollierten Umgebung schnell und effizient durchzuführen, ohne auf menschliche Interaktion angewiesen zu sein. Jede Simulation ist ein vollständiges Spiel von Anfang bis Ende, bei dem die KI entweder gegen sich selbst, gegen eine andere KI-Version oder gegen eine vordefinierte Logik antritt.

### Wie funktioniert die Simulation?

Der `trainingService.ts` ist für die Orchestrierung der Simulationen zuständig. Er initiiert und verwaltet die Spielinstanzen, die für das Training benötigt werden.

1.  **Spielinitialisierung:** Für jede Simulation wird ein neues Spiel initialisiert. Dies beinhaltet das Mischen der Decks, das Austeilen der Startkarten und das Festlegen des Startspielers.
2.  **Rundenbasierter Ablauf:** Das Spiel läuft rundenbasiert ab, genau wie ein normales Spiel.
    *   **Zugphase:** Wenn ein Spieler (oder eine KI) am Zug ist, wird der aktuelle Spielzustand an die entscheidende Instanz (z.B. `aiService.ts`) übergeben.
    *   **Entscheidungsfindung:** Die KI analysiert den Spielzustand (verfügbare Karten auf der Hand, Karten auf dem Spielfeld, Lebenspunkte, Runen, Friedhof, etc.) und wählt basierend auf ihrer aktuellen Strategie den besten Zug aus. Dies kann das Ausspielen einer Karte, das Aktivieren einer Fähigkeit oder das Passen sein.
    *   **Zugausführung:** Der ausgewählte Zug wird im Spiel ausgeführt, was zu einer Aktualisierung des Spielzustands führt.
3.  **Spielende:** Das Spiel endet, wenn eine der Siegbedingungen erfüllt ist (z.B. Lebenspunkte des Gegners auf Null reduziert, Deck leer und keine Karten mehr ziehbar).
4.  **Ergebnisprotokollierung:** Nach jedem Spiel werden wichtige Informationen wie der Gewinner, die Dauer des Spiels, die gespielten Züge und möglicherweise Zwischenstände protokolliert. Diese Daten sind entscheidend für das spätere Training.

### Warum wird simuliert?

*   **Effizienz:** Simulationen ermöglichen es, Tausende oder sogar Millionen von Spielen in kurzer Zeit durchzuführen, was für das Training von maschinellen Lernmodellen unerlässlich ist.
*   **Kontrollierte Umgebung:** Die Simulationsumgebung ist deterministisch und reproduzierbar. Dies ist wichtig, um die Auswirkungen von Änderungen an der KI-Logik oder den Trainingsparametern genau bewerten zu können.
*   **Datenbeschaffung:** Jede Simulation generiert wertvolle Daten über Spielzustände und die entsprechenden optimalen Züge, die als Trainingsdaten für die KI verwendet werden können.
*   **Risikofreies Experimentieren:** Neue Strategien oder KI-Modelle können in der Simulation getestet werden, ohne das Risiko einzugehen, die Leistung in einer Live-Umgebung zu beeinträchtigen.

## KI-Training

### Was ist das KI-Training?

Das KI-Training ist der Prozess, bei dem die KI lernt, bessere Entscheidungen im Spiel zu treffen. Es nutzt die Daten aus den Simulationen, um die internen Parameter oder Modelle der KI anzupassen, sodass sie in zukünftigen Spielen erfolgreicher ist.

### Wie funktioniert das KI-Training?

Der `aiService.ts` ist der zentrale Dienst für die KI-Logik und das Training. Er beherbergt das eigentliche KI-Modell und die Algorithmen, die für die Entscheidungsfindung und das Lernen verantwortlich sind.

1.  **Datensammlung:** Wie oben beschrieben, werden durch Simulationen große Mengen an Spieldaten gesammelt. Diese Daten umfassen Spielzustände, die von der KI getroffenen Entscheidungen und die Ergebnisse dieser Entscheidungen (Gewinn/Verlust).
2.  **Modellauswahl:** Je nach Komplexität und Anforderungen kann die KI verschiedene Lernansätze verwenden:
    *   **Regelbasierte KI:** Eine grundlegende KI könnte auf einem Satz von vordefinierten Regeln basieren (z.B. "Spiele immer die Karte, die den meisten Schaden verursacht"). Diese Regeln können manuell optimiert werden.
    *   **Monte-Carlo Tree Search (MCTS):** Eine fortgeschrittenere KI könnte MCTS verwenden, um zukünftige Spielzustände zu simulieren und den besten Zug basierend auf den Ergebnissen dieser internen Simulationen zu finden. Das Training würde hier die Bewertungsfunktion für die Knoten im Baum verbessern.
    *   **Reinforcement Learning (RL):** Die anspruchsvollste Methode, bei der die KI durch "Versuch und Irrtum" lernt. Sie erhält Belohnungen für gute Züge (z.B. Schaden verursachen, Spiel gewinnen) und Bestrafungen für schlechte Züge. Ein neuronales Netz könnte verwendet werden, um eine Politik (welchen Zug man machen soll) oder eine Wertfunktion (wie gut ein Spielzustand ist) zu lernen.
3.  **Modellaktualisierung:** Basierend auf den gesammelten Daten und dem gewählten Lernalgorithmus wird das KI-Modell aktualisiert.
    *   Bei regelbasierten Systemen könnten dies Anpassungen an den Prioritäten der Regeln sein.
    *   Bei MCTS könnte die Bewertungsfunktion, die die Knoten im Suchbaum bewertet, durch ein neuronales Netz ersetzt und trainiert werden.
    *   Bei Reinforcement Learning werden die Gewichte und Biases eines neuronalen Netzes angepasst, um die Vorhersagen der Politik oder Wertfunktion zu verbessern.
4.  **Evaluierung:** Nach einer Trainingsphase wird die neue Version der KI gegen die vorherige Version oder eine Benchmark-KI in weiteren Simulationen getestet, um ihre Leistungsverbesserung zu bewerten.
5.  **Iterativer Prozess:** Der gesamte Prozess der Datensammlung, des Trainings und der Evaluierung ist iterativ. Die KI lernt kontinuierlich, indem sie neue Daten generiert und ihr Modell immer wieder verfeinert.

### Warum wird die KI trainiert?

*   **Leistungsverbesserung:** Das Hauptziel ist es, die KI so zu verbessern, dass sie immer bessere Entscheidungen trifft und eine größere Gewinnwahrscheinlichkeit gegen menschliche Spieler oder andere KIs hat.
*   **Anpassungsfähigkeit:** Durch Training kann die KI lernen, sich an verschiedene Spielstile, Deckzusammenstellungen und Metas anzupassen.
*   **Entdeckung neuer Strategien:** Eine gut trainierte KI kann möglicherweise Strategien entdecken, die für menschliche Spieler nicht offensichtlich waren.
*   **Robuste Entscheidungsfindung:** Das Training hilft der KI, auch in komplexen oder unerwarteten Spielsituationen robuste und logische Entscheidungen zu treffen.
*   **Automatisierung der Entwicklung:** Anstatt jede Regel manuell zu programmieren, kann die KI durch Training selbstständig lernen, was zu einer effizienteren Entwicklung führt.

Zusammenfassend lässt sich sagen, dass die Kombination aus schnellen Simulationen und einem iterativen Trainingsprozess es dem Runenkrieg-KI-System ermöglicht, sich kontinuierlich zu verbessern und ein herausfordernder Gegner zu sein.
```

---


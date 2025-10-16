import { useState, useCallback, useEffect } from 'react';
import { Card, ElementType, GameHistoryEntry, HeroName, WeatherType, Winner } from '../types';
import {
    ELEMENTS,
    ABILITIES,
    HAND_SIZE,
    START_TOKENS,
    HEROES,
    WEATHER_EFFECTS,
    ELEMENT_HIERARCHIE,
    CARD_TYPES,
    ABILITY_MECHANICS,
    ELEMENT_SYNERGIES
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
        ELEMENTS.forEach((element, elementIndex) => {
            ABILITIES.forEach((wert, abilityIndex) => {
                const cardTypeConfig = CARD_TYPES[(elementIndex + abilityIndex) % CARD_TYPES.length];
                const mechanics = ABILITY_MECHANICS[wert] || [];
                newDeck.push({
                    element,
                    wert,
                    id: `${element}-${wert}-${elementIndex}-${abilityIndex}`,
                    cardType: cardTypeConfig.name,
                    mechanics,
                    lifespan: cardTypeConfig.defaultLifespan,
                    charges: cardTypeConfig.defaultCharges,
                });
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

    const evaluateElementSynergy = (card: Card, handSnapshot: Card[], history: GameHistoryEntry[], owner: 'player' | 'ai') => {
        let synergyBonus = 0;

        if (card.mechanics.includes('Elementarresonanz')) {
            const sameElementInPlay = history.filter(entry => {
                const playedCard = owner === 'player' ? entry.playerCard : entry.aiCard;
                return playedCard?.element === card.element;
            }).length;
            const sameElementInHand = handSnapshot.filter(c => c.element === card.element).length;
            const resonanceStacks = sameElementInPlay + sameElementInHand;
            if (resonanceStacks >= 2) {
                synergyBonus += 2 + 0.5 * (resonanceStacks - 2);
            }
        }

        ELEMENT_SYNERGIES.forEach(synergy => {
            if (!synergy.elements.includes(card.element)) return;
            const otherElement = synergy.elements.find(el => el !== card.element)!;
            const historyHasOther = history.some(entry => {
                const ally = owner === 'player' ? entry.playerCard : entry.aiCard;
                return ally?.element === otherElement;
            });
            const handHasOther = handSnapshot.some(c => c.element === otherElement);
            if (historyHasOther || handHasOther) {
                synergyBonus += synergy.modifier;
            }
        });

        if (card.mechanics.includes('Fusion')) {
            const fusionPartners = handSnapshot.filter(c => c.element !== card.element && c.mechanics.includes('Fusion')).length;
            if (fusionPartners > 0) {
                synergyBonus += 1 + fusionPartners * 0.5;
            }
        }

        if (card.mechanics.includes('Ketteneffekte')) {
            const lastEntry = history[history.length - 1];
            if (lastEntry) {
                const previousCard = owner === 'player' ? lastEntry.playerCard : lastEntry.aiCard;
                if (previousCard && previousCard.mechanics.includes('Ketteneffekte')) {
                    synergyBonus += 1.5;
                }
            }
        }

        return synergyBonus;
    };

    const evaluateRiskAndWeather = (
        card: Card,
        ownTokens: number,
        opponentTokens: number,
        currentWeather: WeatherType
    ) => {
        const weatherEffectBonus = (WEATHER_EFFECTS[currentWeather] as Record<ElementType, number>)[card.element] || 0;
        let mechanicAdjustment = weatherEffectBonus;

        if (card.mechanics.includes('Überladung')) {
            const pressure = Math.max(0, opponentTokens - ownTokens);
            mechanicAdjustment += pressure >= 2 ? 2 : -1;
        }

        if (card.mechanics.includes('Wetterbindung')) {
            mechanicAdjustment += weatherEffectBonus >= 0 ? weatherEffectBonus + 1 : weatherEffectBonus - 1;
        }

        if (card.cardType === 'Segen/Fluch') {
            mechanicAdjustment += ownTokens < opponentTokens ? 1.5 : -0.5;
        }

        if (card.cardType === 'Artefakt') {
            mechanicAdjustment += 0.5;
        }

        if (card.cardType === 'Beschwörung' && card.lifespan) {
            mechanicAdjustment += Math.max(0, 4 - card.lifespan) * 0.25;
        }

        return mechanicAdjustment;
    };

    const calculateTotalValue = (
        ownCard: Card,
        opponentCard: Card,
        hero: HeroName,
        ownTokens: number,
        opponentTokens: number,
        currentWeather: WeatherType,
        handSnapshot: Card[],
        history: GameHistoryEntry[],
        owner: 'player' | 'ai'
    ) => {
        const baseValue = ABILITIES.indexOf(ownCard.wert);
        const weatherAndRisk = evaluateRiskAndWeather(ownCard, ownTokens, opponentTokens, currentWeather);
        const elementBonus = ELEMENT_HIERARCHIE[ownCard.element]?.[opponentCard.element] ?? 0;
        const heroBonus = HEROES[hero].Element === ownCard.element ? HEROES[hero].Bonus : 0;
        const moraleBonus = Math.min(4, Math.floor(Math.max(0, ownTokens - opponentTokens) / 2));
        const synergyBonus = evaluateElementSynergy(ownCard, handSnapshot, history, owner);

        return baseValue + weatherAndRisk + elementBonus + heroBonus + moraleBonus + synergyBonus;
    };

    const playCard = useCallback((cardIndex: number) => {
        if (gamePhase !== 'playerTurn' || cardIndex >= playerHand.length) return;

        const playedPlayerCard = playerHand[cardIndex];
        setPlayerCard(playedPlayerCard);

        const remainingPlayerHand = playerHand.filter((_, i) => i !== cardIndex);
        setPlayerHand(remainingPlayerHand);
        
        const newWeather = Object.keys(WEATHER_EFFECTS)[Math.floor(Math.random() * Object.keys(WEATHER_EFFECTS).length)] as WeatherType;
        setWeather(newWeather);
        
        const gameState = {
            playerTokens,
            aiTokens,
            weather: newWeather,
            playerHero,
            aiHero,
            history: gameHistory,
            round: gameHistory.length + 1,
            playerHandPreview: remainingPlayerHand,
            aiHandPreview: aiHand,
        };
        const playedAiCard = chooseCard(playedPlayerCard, aiHand, gameState);
        setAiCard(playedAiCard);
        
        const remainingAiHand = aiHand.filter(c => c.id !== playedAiCard.id);
        setAiHand(remainingAiHand);

        setGamePhase('evaluation');

        // --- Evaluation Logic ---
        const playerTotal = calculateTotalValue(
            playedPlayerCard,
            playedAiCard,
            playerHero,
            playerTokens,
            aiTokens,
            newWeather,
            remainingPlayerHand,
            gameHistory,
            'player'
        );
        const aiTotal = calculateTotalValue(
            playedAiCard,
            playedPlayerCard,
            aiHero,
            aiTokens,
            playerTokens,
            newWeather,
            remainingAiHand,
            gameHistory,
            'ai'
        );

        let winner: Winner;
        if (playerTotal > aiTotal) winner = "spieler";
        else if (aiTotal > playerTotal) winner = "gegner";
        else winner = "unentschieden";
        
        setRoundWinner(winner);

        let newPlayerTokens = playerTokens;
        let newAiTokens = aiTokens;
        const winnerCard = winner === 'spieler' ? playedPlayerCard : playedAiCard;

        if (winner !== 'unentschieden') {
            switch (winnerCard.element) {
                case "Feuer":
                    winner === "spieler" ? newAiTokens-- : newPlayerTokens--;
                    break;
                case "Wasser":
                    winner === "spieler" ? (newPlayerTokens++, newAiTokens--) : (newAiTokens++, newPlayerTokens--);
                    break;
                case "Erde":
                    winner === "spieler" ? newPlayerTokens++ : newAiTokens++;
                    break;
                case "Luft":
                    winner === "spieler" ? newPlayerTokens += 2 : newAiTokens += 2;
                    break;
                case "Blitz":
                    winner === "spieler" ? newPlayerTokens++ : newAiTokens++;
                    break;
                case "Eis":
                    winner === "spieler" ? newAiTokens-- : newPlayerTokens--;
                    break;
                case "Schatten":
                    if (winner === 'spieler') {
                        if (newAiTokens > 0) {
                            newAiTokens--;
                            newPlayerTokens++;
                        }
                    } else {
                        if (newPlayerTokens > 0) {
                            newPlayerTokens--;
                            newAiTokens++;
                        }
                    }
                    break;
                case "Licht":
                    winner === 'spieler' ? newPlayerTokens += 2 : newAiTokens += 2;
                    break;
                case "Chaos": {
                    const chaosSwing = (gameHistory.length + 1) % 2 === 0 ? 1 : -1;
                    if (chaosSwing > 0) {
                        if (winner === 'spieler') {
                            newPlayerTokens++;
                            newAiTokens = Math.max(0, newAiTokens - 1);
                        } else {
                            newAiTokens++;
                            newPlayerTokens = Math.max(0, newPlayerTokens - 1);
                        }
                    } else {
                        if (winner === 'spieler') {
                            newPlayerTokens = Math.max(0, newPlayerTokens - 1);
                            newAiTokens++;
                        } else {
                            newAiTokens = Math.max(0, newAiTokens - 1);
                            newPlayerTokens++;
                        }
                    }
                    break;
                }
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

    }, [gamePhase, playerHand, aiHand, deck, playerTokens, aiTokens, playerHero, aiHero, gameHistory]);

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
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
import { useState, useCallback, useEffect } from 'react';
import {
    Card,
    ElementType,
    GameHistoryEntry,
    HeroName,
    WeatherType,
    Winner,
    ValueType,
} from '../types';
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
import {
    evaluateElementSynergy,
    evaluateRiskAndWeather,
    resolveMechanicEffects,
} from '../services/mechanicEngine';

const getAbilityIndex = (value: Card['wert']) => ABILITIES.indexOf(value);

let generatedCardCounter = 0;

const createCardTemplate = (element: ElementType, ability: ValueType, idSuffix: string): Card => {
    const elementIndex = ELEMENTS.indexOf(element);
    const abilityIndex = ABILITIES.indexOf(ability);
    const cardTypeConfig = CARD_TYPES[(elementIndex + abilityIndex) % CARD_TYPES.length];

    return {
        element,
        wert: ability,
        id: `${element}-${ability}-${idSuffix}`,
        cardType: cardTypeConfig.name,
        mechanics: ABILITY_MECHANICS[ability] || [],
        lifespan: cardTypeConfig.defaultLifespan,
        charges: cardTypeConfig.defaultCharges,
    };
};

const generateReplacementCard = (owner: 'spieler' | 'gegner'): Card => {
    const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    const ability = ABILITIES[Math.floor(Math.random() * ABILITIES.length)];
    return createCardTemplate(element, ability, `${owner}-generated-${generatedCardCounter++}`);
};

const refillHand = (
    hand: Card[],
    deck: Card[],
    owner: 'spieler' | 'gegner'
): { hand: Card[]; deck: Card[] } => {
    const updatedHand = [...hand];
    const updatedDeck = [...deck];

    while (updatedHand.length < HAND_SIZE) {
        if (updatedDeck.length > 0) {
            updatedHand.push(updatedDeck.pop()!);
        } else {
            updatedHand.push(generateReplacementCard(owner));
        }
    }

    return { hand: updatedHand, deck: updatedDeck };
};

const determineFusionElement = (first: Card, second: Card): ElementType => {
    const synergy = ELEMENT_SYNERGIES.find(
        entry => entry.elements.includes(first.element) && entry.elements.includes(second.element)
    );

    if (synergy) {
        return first.element === synergy.elements[0] ? first.element : second.element;
    }

    return getAbilityIndex(first.wert) >= getAbilityIndex(second.wert) ? first.element : second.element;
};

const createFusionCard = (primary: Card, secondary: Card): Card => {
    const combinedIndex = Math.min(
        getAbilityIndex(primary.wert) + getAbilityIndex(secondary.wert),
        ABILITIES.length - 1
    );
    const fusedValue = ABILITIES[combinedIndex];
    const fusedElement = determineFusionElement(primary, secondary);
    const mergedMechanics = Array.from(new Set([...primary.mechanics, ...secondary.mechanics, 'Fusion']));
    const fusionCardType = primary.cardType === secondary.cardType ? primary.cardType : 'Beschwörung';
    const maxLifespan = Math.max(primary.lifespan ?? 0, secondary.lifespan ?? 0);
    const fusedLifespan = maxLifespan > 0 ? maxLifespan + 1 : undefined;
    const totalCharges = (primary.charges ?? 0) + (secondary.charges ?? 0);
    const fusedCharges = totalCharges > 0 ? totalCharges : undefined;

    return {
        element: fusedElement,
        wert: fusedValue,
        id: `fusion-${primary.id}-${secondary.id}-${Date.now()}`,
        cardType: fusionCardType,
        mechanics: mergedMechanics,
        lifespan: fusedLifespan,
        charges: fusedCharges,
    };
};

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
    const [fusionSelection, setFusionSelection] = useState<{ card: Card; index: number } | null>(null);

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
        setFusionSelection(null);
        setGamePhase('playerTurn');
        setStatusText('Du bist am Zug. Wähle eine Karte.');
    }, [createDeck]);

    const resolveMechanicOutcomes = useCallback((params: {
        winner: Winner;
        playerCard: Card;
        aiCard: Card;
        weather: WeatherType;
        remainingPlayerHand: Card[];
        remainingAiHand: Card[];
        basePlayerTokens: number;
        baseAiTokens: number;
    }) =>
        resolveMechanicEffects({
            ...params,
            history: gameHistory,
        }),
    [gameHistory]);

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

    const playCard = useCallback((cardId: string) => {
        if (gamePhase !== 'playerTurn') {
            return;
        }

        const cardIndex = playerHand.findIndex(card => card.id === cardId);
        if (cardIndex === -1) {
            return;
        }

        const selectedCard = playerHand[cardIndex];

        if (fusionSelection) {
            if (fusionSelection.card.id !== selectedCard.id && !selectedCard.mechanics.includes('Fusion')) {
                setStatusText('Für eine Fusion muss die zweite Karte ebenfalls die Fusion-Mechanik besitzen.');
                return;
            }

            if (fusionSelection.card.id !== selectedCard.id) {
                const fusedCard = createFusionCard(fusionSelection.card, selectedCard);
                const filteredHand = playerHand.filter((_, index) => index !== cardIndex && index !== fusionSelection.index);
                const { hand: toppedHand, deck: remainingDeck } = refillHand(
                    [...filteredHand, fusedCard],
                    deck,
                    'spieler'
                );
                setDeck(remainingDeck);
                setPlayerHand(toppedHand);
                setFusionSelection(null);
                setStatusText(`Fusion erfolgreich: ${fusedCard.wert} (${fusedCard.element}) bereit zum Einsatz.`);
                return;
            }

            setFusionSelection(null);
            setStatusText('Fusion abgebrochen. Die Karte wird ausgespielt.');
        } else if (selectedCard.mechanics.includes('Fusion')) {
            const hasPartner = playerHand.some((card, index) => index !== cardIndex && card.mechanics.includes('Fusion'));
            if (hasPartner) {
                setFusionSelection({ card: selectedCard, index: cardIndex });
                setStatusText('Fusion vorbereitet. Wähle eine zweite Fusionskarte oder klicke erneut zum Ausspielen.');
                return;
            }
        }

        const playedPlayerCard = selectedCard;
        setPlayerCard(playedPlayerCard);

        const remainingPlayerHand = playerHand.filter((_, i) => i !== cardIndex);
        setPlayerHand(remainingPlayerHand);

        const weatherKeys = Object.keys(WEATHER_EFFECTS) as WeatherType[];
        const newWeather = weatherKeys[Math.floor(Math.random() * weatherKeys.length)];
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

        let winner: Winner = 'unentschieden';
        if (playerTotal > aiTotal) {
            winner = 'spieler';
        } else if (aiTotal > playerTotal) {
            winner = 'gegner';
        }

        setRoundWinner(winner);

        let newPlayerTokens = playerTokens;
        let newAiTokens = aiTokens;
        const winnerCard = winner === 'spieler' ? playedPlayerCard : winner === 'gegner' ? playedAiCard : null;

        if (winner !== 'unentschieden' && winnerCard) {
            switch (winnerCard.element) {
                case 'Feuer':
                    winner === 'spieler' ? newAiTokens-- : newPlayerTokens--;
                    break;
                case 'Wasser':
                    if (winner === 'spieler') {
                        newPlayerTokens++;
                        newAiTokens--;
                    } else {
                        newAiTokens++;
                        newPlayerTokens--;
                    }
                    break;
                case 'Erde':
                    winner === 'spieler' ? newPlayerTokens++ : newAiTokens++;
                    break;
                case 'Luft':
                    winner === 'spieler' ? (newPlayerTokens += 2) : (newAiTokens += 2);
                    break;
                case 'Blitz':
                    winner === 'spieler' ? newPlayerTokens++ : newAiTokens++;
                    break;
                case 'Eis':
                    winner === 'spieler' ? newAiTokens-- : newPlayerTokens--;
                    break;
                case 'Schatten':
                    if (winner === 'spieler') {
                        if (newAiTokens > 0) {
                            newAiTokens--;
                            newPlayerTokens++;
                        }
                    } else if (newPlayerTokens > 0) {
                        newPlayerTokens--;
                        newAiTokens++;
                    }
                    break;
                case 'Licht':
                    winner === 'spieler' ? (newPlayerTokens += 2) : (newAiTokens += 2);
                    break;
                case 'Chaos': {
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

        const mechanicOutcome = resolveMechanicOutcomes({
            winner,
            playerCard: playedPlayerCard,
            aiCard: playedAiCard,
            weather: newWeather,
            remainingPlayerHand,
            remainingAiHand,
            basePlayerTokens: newPlayerTokens,
            baseAiTokens: newAiTokens,
        });

        newPlayerTokens = Math.max(0, mechanicOutcome.playerTokens);
        newAiTokens = Math.max(0, mechanicOutcome.aiTokens);

        setPlayerTokens(newPlayerTokens);
        setAiTokens(newAiTokens);

        setGameHistory(prev => [
            ...prev,
            {
                round: prev.length + 1,
                playerCard: playedPlayerCard,
                aiCard: playedAiCard,
                weather: newWeather,
                winner,
                playerTokens: newPlayerTokens,
                aiTokens: newAiTokens,
            },
        ]);

        const roundLabel = winner === 'unentschieden'
            ? `Runde ${gameHistory.length + 1}: Unentschieden!`
            : `Runde ${gameHistory.length + 1}: ${winner} gewinnt den Stich!`;
        const combinedStatus = mechanicOutcome.messages.length > 0
            ? `${roundLabel} ${mechanicOutcome.messages.join(' ')}`
            : roundLabel;
        setStatusText(combinedStatus);

        setTimeout(() => {
            let tempDeck = [...deck];
            const playerRefill = refillHand(remainingPlayerHand, tempDeck, 'spieler');
            const aiRefill = refillHand(remainingAiHand, playerRefill.deck, 'gegner');

            tempDeck = aiRefill.deck;
            const tempPlayerHand = playerRefill.hand;
            const tempAiHand = aiRefill.hand;

            setDeck(tempDeck);
            setPlayerHand(tempPlayerHand);
            setAiHand(tempAiHand);
            setPlayerCard(null);
            setAiCard(null);

            if (newPlayerTokens <= 0 || newAiTokens <= 0 || (tempPlayerHand.length === 0 && tempAiHand.length === 0)) {
                setGamePhase('gameOver');
                const finalWinner = newPlayerTokens > newAiTokens
                    ? 'spieler'
                    : newAiTokens > newPlayerTokens
                        ? 'gegner'
                        : 'unentschieden';
                setStatusText(`Spiel vorbei! ${finalWinner === 'unentschieden' ? 'Unentschieden' : `${finalWinner} hat gewonnen!`}`);
            } else {
                setGamePhase('playerTurn');
                setStatusText('Nächste Runde. Wähle eine Karte.');
            }
        }, 3000);

    }, [
        gamePhase,
        playerHand,
        aiHand,
        deck,
        playerTokens,
        aiTokens,
        playerHero,
        aiHero,
        gameHistory,
        fusionSelection,
        resolveMechanicOutcomes,
    ]);

    useEffect(() => {
        if (gamePhase === 'start') {
            startGame();
        }
    }, [gamePhase, startGame]);

    return {
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
        fusionSelectionId: fusionSelection?.card.id ?? null,
        playCard,
        startGame,
    };
};
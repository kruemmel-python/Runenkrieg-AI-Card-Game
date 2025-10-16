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

const getAbilityIndex = (value: Card['wert']) => ABILITIES.indexOf(value);

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

    const resolveMechanicOutcomes = useCallback((params: {
        winner: Winner;
        playerCard: Card;
        aiCard: Card;
        weather: WeatherType;
        remainingPlayerHand: Card[];
        remainingAiHand: Card[];
        basePlayerTokens: number;
        baseAiTokens: number;
    }) => {
        let tokens = { player: params.basePlayerTokens, ai: params.baseAiTokens };
        const messages: string[] = [];

        const applyMechanics = (card: Card, owner: 'player' | 'ai', didWin: boolean, remainingHand: Card[]) => {
            if (!card) return;

            const ownerKey = owner === 'player' ? 'player' : 'ai';
            const opponentKey = owner === 'player' ? 'ai' : 'player';

            if (card.mechanics.includes('Ketteneffekte') && didWin) {
                const lastEntry = gameHistory[gameHistory.length - 1];
                if (lastEntry) {
                    const previousCard = owner === 'player' ? lastEntry.playerCard : lastEntry.aiCard;
                    const ownerWinner = owner === 'player' ? 'spieler' : 'gegner';
                    if (previousCard?.mechanics.includes('Ketteneffekte') && lastEntry.winner === ownerWinner) {
                        tokens[opponentKey] = Math.max(0, tokens[opponentKey] - 1);
                        messages.push(
                            owner === 'player'
                                ? 'Ketteneffekte: Deine Kombinationsattacke entzieht dem Gegner einen zusätzlichen Token.'
                                : 'Ketteneffekte: Die KI-Kombination kostet dich einen weiteren Token.'
                        );
                    }
                }
            }

            if (card.mechanics.includes('Elementarresonanz') && didWin) {
                const resonanceCount = gameHistory.filter(entry => {
                    const pastCard = owner === 'player' ? entry.playerCard : entry.aiCard;
                    return pastCard?.element === card.element;
                }).length + 1;
                if (resonanceCount >= 3) {
                    tokens[ownerKey] += 1;
                    messages.push(
                        owner === 'player'
                            ? 'Elementarresonanz: Deine Linie pulsiert – +1 Token.'
                            : 'Elementarresonanz: Die KI bündelt ihr Element und erhält +1 Token.'
                    );
                }
            }

            if (card.mechanics.includes('Überladung')) {
                tokens[ownerKey] = Math.max(0, tokens[ownerKey] - 1);
                messages.push(
                    owner === 'player'
                        ? 'Überladung: Die immense Macht kostet dich 1 Token.'
                        : 'Überladung: Die KI erleidet 1 Token Überlastungsschaden.'
                );
            }

            if (card.mechanics.includes('Wetterbindung') && params.weather) {
                const modifier = (WEATHER_EFFECTS[params.weather] as Record<ElementType, number>)[card.element] ?? 0;
                if (modifier > 0) {
                    tokens[ownerKey] += modifier;
                    messages.push(
                        owner === 'player'
                            ? `Wetterbindung: ${params.weather} stärkt dich (+${modifier} Token).`
                            : `Wetterbindung: ${params.weather} stärkt die KI (+${modifier} Token).`
                    );
                } else if (modifier < 0) {
                    const loss = Math.min(tokens[ownerKey], Math.abs(modifier));
                    tokens[ownerKey] -= loss;
                    if (loss > 0) {
                        messages.push(
                            owner === 'player'
                                ? `Wetterbindung: ${params.weather} schwächt dich (-${loss} Token).`
                                : `Wetterbindung: ${params.weather} schwächt die KI (-${loss} Token).`
                        );
                    }
                }
            }

            if (card.mechanics.includes('Verbündeter')) {
                const allies = remainingHand.filter(handCard => handCard.element === card.element).length;
                if (allies > 0) {
                    tokens[ownerKey] += 1;
                    messages.push(
                        owner === 'player'
                            ? 'Verbündete sammeln sich: +1 Token.'
                            : 'Die Verbündeten der KI sichern ihr +1 Token.'
                    );
                }
            }

            if (card.mechanics.includes('Segen/Fluch')) {
                if (tokens[ownerKey] < tokens[opponentKey]) {
                    tokens[ownerKey] += 1;
                    messages.push(
                        owner === 'player'
                            ? 'Segen: Deine Kräfte erholen sich (+1 Token).'
                            : 'Segen: Die KI regeneriert einen Token.'
                    );
                } else {
                    tokens[opponentKey] = Math.max(0, tokens[opponentKey] - 1);
                    messages.push(
                        owner === 'player'
                            ? 'Fluch: Der Gegner verliert einen Token.'
                            : 'Fluch: Du verlierst einen Token.'
                    );
                }
            }
        };

        applyMechanics(params.playerCard, 'player', params.winner === 'spieler', params.remainingPlayerHand);
        applyMechanics(params.aiCard, 'ai', params.winner === 'gegner', params.remainingAiHand);

        return {
            playerTokens: Math.max(0, tokens.player),
            aiTokens: Math.max(0, tokens.ai),
            messages,
        };
    }, [gameHistory]);

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
                const updatedHand = playerHand.filter((_, index) => index !== cardIndex && index !== fusionSelection.index);
                setPlayerHand([...updatedHand, fusedCard]);
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
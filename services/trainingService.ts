import {
    Card,
    RoundResult,
    TrainedModel,
    WeatherType,
    Winner,
    HeroName,
    TrainingAnalysis,
    GameHistoryEntry,
    ElementType,
    AbilityMechanicName,
    ContextInsight,
    TokenDeltaCoverage,
    HeroMatchupInsight,
    ElementCounterInsight,
    MechanicEffectivenessInsight,
    ValueType,
} from '../types';
import {
    ELEMENTS,
    ABILITIES,
    WEATHER_EFFECTS,
    ELEMENT_HIERARCHIE,
    HEROES,
    CARD_TYPES,
    ABILITY_MECHANICS,
} from '../constants';
import {
    evaluateElementSynergy,
    evaluateRiskAndWeather,
    resolveMechanicEffects,
} from './mechanicEngine';

// --- Simulation Logic (now mirrors real game logic) ---

function calculateTotalValueInSim(
    ownCard: Card,
    opponentCard: Card,
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    currentWeather: WeatherType,
    handSnapshot: Card[],
    history: GameHistoryEntry[],
    owner: 'spieler' | 'gegner'
): number {
    const baseValue = ABILITIES.indexOf(ownCard.wert);
    const weatherRisk = evaluateRiskAndWeather(ownCard, ownTokens, opponentTokens, currentWeather);
    const elementBonus = ELEMENT_HIERARCHIE[ownCard.element]?.[opponentCard.element] ?? 0;
    const heroBonus = HEROES[hero].Element === ownCard.element ? HEROES[hero].Bonus : 0;
    const moraleBonus = Math.min(4, Math.floor(Math.max(0, ownTokens - opponentTokens) / 2));
    const synergyBonus = evaluateElementSynergy(
        ownCard,
        handSnapshot,
        history,
        owner === 'spieler' ? 'player' : 'ai'
    );

    return baseValue + weatherRisk + elementBonus + heroBonus + moraleBonus + synergyBonus;
}

// Helper to apply element effects in simulation
function applyElementEffect(
    winner: Winner,
    winnerCard: Card,
    pTokens: number,
    aTokens: number,
    historyLength: number
): [number, number] {
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
                const chaosSwing = (historyLength + 1) % 2 === 0 ? 1 : -1;
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
    return [newPlayerTokens, newAiTokens];
}


function determineWinnerInSim(
    playerCard: Card,
    aiCard: Card,
    playerHero: HeroName,
    aiHero: HeroName,
    pTokens: number,
    aTokens: number,
    weather: WeatherType,
    playerHandSnapshot: Card[],
    aiHandSnapshot: Card[],
    history: GameHistoryEntry[]
): Winner {
    const playerTotal = calculateTotalValueInSim(
        playerCard,
        aiCard,
        playerHero,
        pTokens,
        aTokens,
        weather,
        playerHandSnapshot,
        history,
        'spieler'
    );
    const aiTotal = calculateTotalValueInSim(
        aiCard,
        playerCard,
        aiHero,
        aTokens,
        pTokens,
        weather,
        aiHandSnapshot,
        history,
        'gegner'
    );

    if (playerTotal > aiTotal) return "spieler";
    if (aiTotal > playerTotal) return "gegner";
    return "unentschieden";
}

function generateDeck(): Card[] {
    const deck: Card[] = [];
    ELEMENTS.forEach((element, elementIndex) => {
        ABILITIES.forEach((wert, abilityIndex) => {
            const cardType = CARD_TYPES[(elementIndex + abilityIndex) % CARD_TYPES.length];
            deck.push({
                element,
                wert,
                id: `${element}-${wert}-${elementIndex}-${abilityIndex}`,
                cardType: cardType.name,
                mechanics: ABILITY_MECHANICS[wert] || [],
                lifespan: cardType.defaultLifespan,
                charges: cardType.defaultCharges,
            });
        });
    });
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

        const history: GameHistoryEntry[] = [];

        while (playerTokens > 0 && aiTokens > 0 && playerHand.length > 0 && aiHand.length > 0) {
            const weather = Object.keys(WEATHER_EFFECTS)[Math.floor(Math.random() * Object.keys(WEATHER_EFFECTS).length)] as WeatherType;

            const playerCard = playerHand.splice(Math.floor(Math.random() * playerHand.length), 1)[0];
            const aiCard = aiHand.splice(Math.floor(Math.random() * aiHand.length), 1)[0];

            const prePlayerTokens = playerTokens;
            const preAiTokens = aiTokens;

            const winner = determineWinnerInSim(
                playerCard,
                aiCard,
                playerHero,
                aiHero,
                playerTokens,
                aiTokens,
                weather,
                playerHand,
                aiHand,
                history
            );

            // UPDATED: Apply accurate element effects
            const winnerCard = winner === 'spieler' ? playerCard : aiCard;
            [playerTokens, aiTokens] = applyElementEffect(winner, winnerCard, playerTokens, aiTokens, history.length);

            const mechanicOutcome = resolveMechanicEffects({
                winner,
                playerCard,
                aiCard,
                weather,
                remainingPlayerHand: playerHand,
                remainingAiHand: aiHand,
                basePlayerTokens: playerTokens,
                baseAiTokens: aiTokens,
                history,
            });

            playerTokens = mechanicOutcome.playerTokens;
            aiTokens = mechanicOutcome.aiTokens;

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

            history.push({
                round: history.length + 1,
                playerCard,
                aiCard,
                weather,
                winner,
                playerTokens,
                aiTokens,
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
    let contextsWithLightData = 0;

    const parseCardString = (cardLabel: string): { element: ElementType; ability: ValueType } => {
        const [element, ...abilityParts] = cardLabel.split(' ');
        return {
            element: element as ElementType,
            ability: abilityParts.join(' ') as ValueType,
        };
    };

    const contextDetails: ContextInsight[] = [];
    const deltaCoverage = new Map<number, { contexts: number; solid: number; winRateSum: number }>();
    const heroMatchupMap = new Map<string, { contexts: number; observations: number; winRateSum: number; topContext?: ContextInsight }>();
    const elementCounterMap = new Map<ElementType, Map<string, { wins: number; total: number }>>();
    const mechanicStats = new Map<AbilityMechanicName, { wins: number; total: number }>();

    for (const [contextKey, aiCardMap] of modelData.entries()) {
        const [playerCardLabel, weatherString, heroMatchupString, deltaString] = contextKey.split('|');
        const weather = weatherString as WeatherType;
        const [playerHero, aiHero] = heroMatchupString.split('vs') as [HeroName, HeroName];
        const tokenDelta = Number(deltaString.replace('delta:', ''));
        const { element: playerElement } = parseCardString(playerCardLabel);

        for (const [cardKey, stats] of aiCardMap.entries()) {
            if (stats.total === 0) continue;

            const { ability: aiAbility } = parseCardString(cardKey);
            const elementCounters = elementCounterMap.get(playerElement) ?? new Map<string, { wins: number; total: number }>();
            const counterStats = elementCounters.get(cardKey) ?? { wins: 0, total: 0 };
            counterStats.wins += stats.wins;
            counterStats.total += stats.total;
            elementCounters.set(cardKey, counterStats);
            elementCounterMap.set(playerElement, elementCounters);

            const mechanics = ABILITY_MECHANICS[aiAbility] ?? [];
            mechanics.forEach((mechanic) => {
                const current = mechanicStats.get(mechanic as AbilityMechanicName) ?? { wins: 0, total: 0 };
                current.wins += stats.wins;
                current.total += stats.total;
                mechanicStats.set(mechanic as AbilityMechanicName, current);
            });
        }

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
            if (bestStats.total < 5) {
                contextsWithLightData += 1;
            }

            const contextInsight: ContextInsight = {
                playerCard: playerCardLabel,
                weather,
                playerHero,
                aiHero,
                tokenDelta,
                aiCard: bestCardKey,
                winRate: bestWinRate,
                observations: bestStats.total,
            };

            contextDetails.push(contextInsight);

            if (!bestContext || bestWinRate > bestContext.winRate) {
                bestContext = {
                    playerCard: playerCardLabel,
                    weather,
                    playerHero,
                    aiHero,
                    tokenDelta,
                    aiCard: bestCardKey,
                    winRate: bestWinRate,
                    observations: bestStats.total,
                };
            }

            const deltaStats = deltaCoverage.get(tokenDelta) ?? { contexts: 0, solid: 0, winRateSum: 0 };
            deltaStats.contexts += 1;
            if (bestStats.total >= 5) {
                deltaStats.solid += 1;
            }
            if (bestWinRate >= 0) {
                deltaStats.winRateSum += bestWinRate;
            }
            deltaCoverage.set(tokenDelta, deltaStats);

            const heroKey = `${playerHero}|${aiHero}`;
            const heroStats = heroMatchupMap.get(heroKey) ?? { contexts: 0, observations: 0, winRateSum: 0, topContext: undefined as ContextInsight | undefined };
            heroStats.contexts += 1;
            heroStats.observations += bestStats.total;
            heroStats.winRateSum += bestWinRate;
            if (!heroStats.topContext || bestStats.total > heroStats.topContext.observations) {
                heroStats.topContext = contextInsight;
            }
            heroMatchupMap.set(heroKey, heroStats);
        } else {
            const deltaStats = deltaCoverage.get(tokenDelta) ?? { contexts: 0, solid: 0, winRateSum: 0 };
            deltaStats.contexts += 1;
            deltaCoverage.set(tokenDelta, deltaStats);
        }
    }

    const totalContexts = modelData.size;
    const contextsNeedingData = contextsWithLightData;
    const averageBestWinRate = contextsWithBestCard > 0 ? winRateSum / contextsWithBestCard : 0;

    const topContexts = contextDetails
        .filter((context) => context.observations >= 5)
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, 5);

    const strugglingContexts = contextDetails
        .filter((context) => context.observations >= 5)
        .sort((a, b) => a.winRate - b.winRate)
        .slice(0, 5);

    const dataGaps = contextDetails
        .filter((context) => context.observations < 5)
        .sort((a, b) => b.observations - a.observations)
        .slice(0, 5);

    const coverageByTokenDelta: TokenDeltaCoverage[] = Array.from(deltaCoverage.entries())
        .map(([delta, stats]) => ({
            tokenDelta: delta,
            contextCount: stats.contexts,
            solidDataContexts: stats.solid,
            averageWinRate: stats.contexts > 0 ? stats.winRateSum / stats.contexts : 0,
        }))
        .sort((a, b) => a.tokenDelta - b.tokenDelta);

    const heroMatchupInsights: HeroMatchupInsight[] = Array.from(heroMatchupMap.entries())
        .map(([key, stats]) => {
            const [playerHero, aiHero] = key.split('|') as [HeroName, HeroName];
            return {
                playerHero,
                aiHero,
                contexts: stats.contexts,
                observations: stats.observations,
                averageBestWinRate: stats.contexts > 0 ? stats.winRateSum / stats.contexts : 0,
                topCounter: stats.topContext,
            };
        })
        .sort((a, b) => b.observations - a.observations)
        .slice(0, 6);

    const elementCounterInsights: ElementCounterInsight[] = Array.from(elementCounterMap.entries())
        .map(([playerElement, counters]) => ({
            playerElement,
            counters: Array.from(counters.entries())
                .map(([cardKey, stats]) => ({
                    aiCard: cardKey,
                    winRate: stats.total > 0 ? stats.wins / stats.total : 0,
                    observations: stats.total,
                }))
                .filter((entry) => entry.observations >= 3)
                .sort((a, b) => b.winRate - a.winRate)
                .slice(0, 3),
        }))
        .filter((entry) => entry.counters.length > 0)
        .sort((a, b) => a.playerElement.localeCompare(b.playerElement));

    const mechanicEffectiveness: MechanicEffectivenessInsight[] = Array.from(mechanicStats.entries())
        .map(([mechanic, stats]) => ({
            mechanic,
            winRate: stats.total > 0 ? stats.wins / stats.total : 0,
            observations: stats.total,
        }))
        .sort((a, b) => b.observations - a.observations);

    const analysis: TrainingAnalysis = {
        totalContexts,
        contextsWithSolidData,
        contextsNeedingData,
        averageBestWinRate,
        bestContext,
        topContexts,
        strugglingContexts,
        dataGaps,
        coverageByTokenDelta,
        heroMatchupInsights,
        elementCounterInsights,
        mechanicEffectiveness,
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
import {
    AiGameState,
    AiPlayDecision,
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
    ResamplingRecommendation,
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
import { generateAiPlayOptions } from './aiDecisionEngine';

const WILSON_Z = 1.96;

type ContextMetadata = {
    bestCardKey: string;
    observations: number;
    wilsonLower: number;
    wilsonUpper: number;
    entropy: number;
    baselineWinRate: number;
    bestWinRate: number;
    consolidationStage: 'none' | 'provisional' | 'stable';
};

function wilsonInterval(wins: number, trials: number, z: number = WILSON_Z) {
    if (trials === 0) {
        return { lower: 0, upper: 1, width: 1 };
    }

    const pHat = wins / trials;
    const denominator = 1 + (z ** 2) / trials;
    const center = pHat + (z ** 2) / (2 * trials);
    const margin =
        z * Math.sqrt((pHat * (1 - pHat)) / trials + (z ** 2) / (4 * trials ** 2));
    const lower = Math.max(0, (center - margin) / denominator);
    const upper = Math.min(1, (center + margin) / denominator);
    return { lower, upper, width: upper - lower };
}

function computeEvidenceScore(lower: number, upper: number): number {
    const width = upper - lower;
    return 0.7 * lower + 0.3 * (1 - Math.min(0.5, width));
}

function computeEntropy(probabilities: number[]): number {
    const filtered = probabilities.filter((p) => p > 0);
    if (filtered.length === 0) return 0;
    const entropy = -filtered.reduce((sum, p) => sum + p * Math.log2(p), 0);
    return entropy;
}

function determineWave(trials: number, winRate: number, intervalWidth: number): { wave: 1 | 2 | 3; target: number } {
    if (trials < 25) {
        return { wave: 1, target: 25 };
    }
    if (trials < 50) {
        return { wave: 2, target: 50 };
    }
    if (trials < 100 && (winRate < 0.25 || intervalWidth > 0.3)) {
        return { wave: 3, target: 100 };
    }
    return { wave: 3, target: trials };
}

function assignPriority(trials: number, wilsonLower: number, winRate: number, tokenDelta: number): 'MAX' | 'HIGH' | 'MED' | 'NORMAL' {
    if (trials === 0) return 'MAX';
    if (trials < 10 && wilsonLower < 0.5) return 'HIGH';
    if (winRate < 0.25 && tokenDelta >= 3) return 'HIGH';
    if (trials < 25 && wilsonLower < 0.6) return 'MED';
    return 'NORMAL';
}

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

            let aiDecision: AiPlayDecision;
            const aiGameState: AiGameState = {
                playerTokens,
                aiTokens,
                weather,
                playerHero,
                aiHero,
                history,
                round: history.length + 1,
                playerHandPreview: playerHand,
                aiHandPreview: aiHand,
            };

            const aiOptions = generateAiPlayOptions(playerCard, aiHand, aiGameState);
            if (aiOptions.length === 0) {
                const fallbackIndex = Math.floor(Math.random() * aiHand.length);
                const fallbackCard = aiHand.splice(fallbackIndex, 1)[0];
                aiDecision = {
                    card: fallbackCard,
                    consumedCardIds: [fallbackCard.id],
                };
            } else {
                const sortedOptions = [...aiOptions].sort((a, b) => b.score - a.score);
                const topScore = sortedOptions[0].score;
                const candidatePool = sortedOptions.filter(option => Math.abs(option.score - topScore) < 0.75);
                const selectionPool = candidatePool.length > 0 ? candidatePool : sortedOptions;
                const chosen = selectionPool[Math.floor(Math.random() * selectionPool.length)];
                aiDecision = chosen.decision;
                aiHand = aiHand.filter(card => !aiDecision.consumedCardIds.includes(card.id));
            }

            const aiCard = aiDecision.card;

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
    let contextsNeedingData = 0;
    let winRateSum = 0;
    let contextsWithBestCard = 0;
    let bestContext: TrainingAnalysis['bestContext'] | undefined = undefined;

    const parseCardString = (cardLabel: string): { element: ElementType; ability: ValueType } => {
        const [element, ...abilityParts] = cardLabel.split(' ');
        return {
            element: element as ElementType,
            ability: abilityParts.join(' ') as ValueType,
        };
    };

    const contextDetails: ContextInsight[] = [];
    const deltaCoverage = new Map<number, { contexts: number; solid: number; winRateSum: number; baselineSum: number; liftSum: number; observationSum: number }>();
    const heroMatchupMap = new Map<string, { contexts: number; observations: number; winRateSum: number; tokenDeltaSum: number; topContext?: ContextInsight }>();
    const elementCounterMap = new Map<ElementType, Map<string, { wins: number; total: number }>>();
    const mechanicStats = new Map<AbilityMechanicName, {
        wins: number;
        total: number;
        contexts: number;
        sumLift: number;
        tokenDeltaWeighted: number;
        totalWithTrials: number;
        weatherCounts: Map<WeatherType, number>;
    }>();
    const contextMetadata = new Map<string, ContextMetadata>();
    const entropyAlerts: ContextInsight[] = [];

    for (const [contextKey, aiCardMap] of modelData.entries()) {
        const [playerCardLabel, weatherString, heroMatchupString, deltaString] = contextKey.split('|');
        const weather = weatherString as WeatherType;
        const [playerHero, aiHero] = heroMatchupString.split('vs') as [HeroName, HeroName];
        const tokenDelta = Number(deltaString.replace('delta:', ''));
        const { element: playerElement } = parseCardString(playerCardLabel);

        let totalTrials = 0;
        let totalWins = 0;
        const candidateSummaries: {
            cardKey: string;
            wins: number;
            total: number;
            winRate: number;
            wilsonLower: number;
            wilsonUpper: number;
            intervalWidth: number;
            evidenceScore: number;
        }[] = [];
        const mechanicUsage = new Map<AbilityMechanicName, { wins: number; total: number }>();

        for (const [cardKey, stats] of aiCardMap.entries()) {
            if (stats.total === 0) continue;

            totalTrials += stats.total;
            totalWins += stats.wins;

            const interval = wilsonInterval(stats.wins, stats.total);
            const winRate = stats.wins / stats.total;
            candidateSummaries.push({
                cardKey,
                wins: stats.wins,
                total: stats.total,
                winRate,
                wilsonLower: interval.lower,
                wilsonUpper: interval.upper,
                intervalWidth: interval.width,
                evidenceScore: computeEvidenceScore(interval.lower, interval.upper),
            });

            const { ability: aiAbility } = parseCardString(cardKey);
            const elementCounters = elementCounterMap.get(playerElement) ?? new Map<string, { wins: number; total: number }>();
            const counterStats = elementCounters.get(cardKey) ?? { wins: 0, total: 0 };
            counterStats.wins += stats.wins;
            counterStats.total += stats.total;
            elementCounters.set(cardKey, counterStats);
            elementCounterMap.set(playerElement, elementCounters);

            const mechanics = ABILITY_MECHANICS[aiAbility] ?? [];
            mechanics.forEach((mechanic) => {
                const current = mechanicUsage.get(mechanic as AbilityMechanicName) ?? { wins: 0, total: 0 };
                current.wins += stats.wins;
                current.total += stats.total;
                mechanicUsage.set(mechanic as AbilityMechanicName, current);
            });
        }

        if (totalTrials === 0) {
            continue;
        }

        const probabilities = candidateSummaries.map((summary) => summary.total / totalTrials);
        const entropy = computeEntropy(probabilities);
        const baselineWinRate = totalWins / totalTrials;

        const bestCandidate = candidateSummaries.reduce<
            typeof candidateSummaries[number] | null
        >((best, current) => {
            if (!best) return current;
            if (current.wilsonLower > best.wilsonLower) return current;
            if (current.wilsonLower === best.wilsonLower && current.evidenceScore > best.evidenceScore) return current;
            return best;
        }, null);

        if (!bestCandidate) {
            continue;
        }

        contextsWithBestCard += 1;
        winRateSum += bestCandidate.winRate;

        if (bestCandidate.total >= 50) {
            contextsWithSolidData += 1;
        } else if (bestCandidate.total < 25) {
            contextsNeedingData += 1;
        }

        const contextInsight: ContextInsight = {
            playerCard: playerCardLabel,
            weather,
            playerHero,
            aiHero,
            tokenDelta,
            aiCard: bestCandidate.cardKey,
            winRate: bestCandidate.winRate,
            baselineWinRate,
            lift: bestCandidate.winRate - baselineWinRate,
            observations: bestCandidate.total,
            wilsonLower: bestCandidate.wilsonLower,
            wilsonUpper: bestCandidate.wilsonUpper,
            intervalWidth: bestCandidate.intervalWidth,
            evidenceScore: bestCandidate.evidenceScore,
            entropy,
        };

        contextDetails.push(contextInsight);

        if (entropy < 0.3) {
            entropyAlerts.push(contextInsight);
        }

        if (!bestContext || bestCandidate.wilsonLower > bestContext.wilsonLower) {
            bestContext = contextInsight;
        }

        const consolidationStage: ContextMetadata['consolidationStage'] =
            bestCandidate.wilsonLower >= 0.6 && bestCandidate.total >= 50
                ? 'stable'
                : bestCandidate.wilsonLower >= 0.6 && bestCandidate.total >= 25
                ? 'provisional'
                : 'none';

        contextMetadata.set(contextKey, {
            bestCardKey: bestCandidate.cardKey,
            observations: bestCandidate.total,
            wilsonLower: bestCandidate.wilsonLower,
            wilsonUpper: bestCandidate.wilsonUpper,
            entropy,
            baselineWinRate,
            bestWinRate: bestCandidate.winRate,
            consolidationStage,
        });

        const deltaStats = deltaCoverage.get(tokenDelta) ?? {
            contexts: 0,
            solid: 0,
            winRateSum: 0,
            baselineSum: 0,
            liftSum: 0,
            observationSum: 0,
        };
        deltaStats.contexts += 1;
        if (bestCandidate.total >= 50) {
            deltaStats.solid += 1;
        }
        deltaStats.winRateSum += bestCandidate.winRate;
        deltaStats.baselineSum += baselineWinRate;
        deltaStats.liftSum += bestCandidate.winRate - baselineWinRate;
        deltaStats.observationSum += bestCandidate.total;
        deltaCoverage.set(tokenDelta, deltaStats);

        const heroKey = `${playerHero}|${aiHero}`;
        const heroStats =
            heroMatchupMap.get(heroKey) ?? {
                contexts: 0,
                observations: 0,
                winRateSum: 0,
                tokenDeltaSum: 0,
                topContext: undefined as ContextInsight | undefined,
            };
        heroStats.contexts += 1;
        heroStats.observations += bestCandidate.total;
        heroStats.winRateSum += bestCandidate.winRate;
        heroStats.tokenDeltaSum += bestCandidate.total * tokenDelta;
        if (!heroStats.topContext || bestCandidate.total > heroStats.topContext.observations) {
            heroStats.topContext = contextInsight;
        }
        heroMatchupMap.set(heroKey, heroStats);

        mechanicUsage.forEach((usage, mechanic) => {
            const record =
                mechanicStats.get(mechanic) ?? {
                    wins: 0,
                    total: 0,
                    contexts: 0,
                    sumLift: 0,
                    tokenDeltaWeighted: 0,
                    totalWithTrials: 0,
                    weatherCounts: new Map<WeatherType, number>(),
                };
            const withoutWins = totalWins - usage.wins;
            const withoutTotal = totalTrials - usage.total;
            if (usage.total > 0 && withoutTotal > 0) {
                const withRate = usage.wins / usage.total;
                const withoutRate = withoutWins / withoutTotal;
                record.sumLift += withRate - withoutRate;
                record.contexts += 1;
            }
            record.wins += usage.wins;
            record.total += usage.total;
            record.tokenDeltaWeighted += usage.total * tokenDelta;
            record.totalWithTrials += usage.total;
            record.weatherCounts.set(weather, (record.weatherCounts.get(weather) ?? 0) + usage.total);
            mechanicStats.set(mechanic, record);
        });
    }

    const totalContexts = modelData.size;
    const averageBestWinRate = contextsWithBestCard > 0 ? winRateSum / contextsWithBestCard : 0;

    const topContexts = contextDetails
        .filter((context) => context.observations >= 10)
        .sort((a, b) => b.wilsonLower - a.wilsonLower)
        .slice(0, 5);

    const strugglingContexts = contextDetails
        .filter((context) => context.observations >= 10)
        .sort((a, b) => a.wilsonLower - b.wilsonLower)
        .slice(0, 5);

    const dataGaps = contextDetails
        .filter((context) => context.observations < 10)
        .sort((a, b) => a.observations - b.observations)
        .slice(0, 5);

    const coverageByTokenDelta: TokenDeltaCoverage[] = Array.from(deltaCoverage.entries())
        .map(([delta, stats]) => ({
            tokenDelta: delta,
            contextCount: stats.contexts,
            solidDataContexts: stats.solid,
            averageWinRate: stats.contexts > 0 ? stats.winRateSum / stats.contexts : 0,
            averageBaseline: stats.contexts > 0 ? stats.baselineSum / stats.contexts : 0,
            averageLift: stats.contexts > 0 ? stats.liftSum / stats.contexts : 0,
            averageObservations: stats.contexts > 0 ? stats.observationSum / stats.contexts : 0,
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
                averageTokenDelta: stats.observations > 0 ? stats.tokenDeltaSum / stats.observations : 0,
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
        .map(([mechanic, stats]) => {
            const winRate = stats.total > 0 ? stats.wins / stats.total : 0;
            const normalizedLift = stats.contexts > 0 ? stats.sumLift / stats.contexts : 0;
            const averageTokenDelta = stats.totalWithTrials > 0 ? stats.tokenDeltaWeighted / stats.totalWithTrials : 0;
            const totalWeatherTrials = Array.from(stats.weatherCounts.values()).reduce((sum, count) => sum + count, 0);
            const weatherDistribution = Array.from(stats.weatherCounts.entries())
                .map(([weatherKey, count]) => ({
                    weather: weatherKey,
                    share: totalWeatherTrials > 0 ? count / totalWeatherTrials : 0,
                }))
                .sort((a, b) => b.share - a.share);
            return {
                mechanic,
                winRate,
                observations: stats.total,
                normalizedLift,
                contexts: stats.contexts,
                averageTokenDelta,
                weatherDistribution,
            };
        })
        .sort((a, b) => b.observations - a.observations);

    const resamplingPlan = contextDetails
        .map((context) => {
            const priority = assignPriority(context.observations, context.wilsonLower, context.winRate, context.tokenDelta);
            const { wave, target } = determineWave(context.observations, context.winRate, context.intervalWidth);
            const rationaleSegments: string[] = [];
            if (context.observations === 0) rationaleSegments.push('keine Beobachtungen');
            if (context.wilsonLower < 0.5) rationaleSegments.push('unsichere Untergrenze');
            if (context.winRate < 0.25 && context.tokenDelta >= 3) rationaleSegments.push('schwache Performance trotz Vorsprung');
            if (context.intervalWidth > 0.35) rationaleSegments.push('breites Vertrauensintervall');
            return {
                context,
                priority,
                wave,
                currentObservations: context.observations,
                targetObservations: target,
                rationale: rationaleSegments.join(', ') || 'normale Auffrischung',
            };
        })
        .filter((entry) => entry.priority !== 'NORMAL' || entry.currentObservations < entry.targetObservations)
        .sort((a, b) => {
            const priorityOrder: Record<ResamplingRecommendation['priority'], number> = {
                MAX: 0,
                HIGH: 1,
                MED: 2,
                NORMAL: 3,
            };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return a.context.wilsonLower - b.context.wilsonLower;
        })
        .slice(0, 12);

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
        resamplingPlan,
        decisionEntropyAlerts: entropyAlerts.slice(0, 10),
    };

    const predict = (playerCard: Card, aiHand: Card[], gameState: AiGameState): AiPlayDecision => {
        if (aiHand.length === 0) {
            throw new Error('Trained model received an empty AI hand.');
        }

        const tokenDelta = (gameState.playerTokens ?? 0) - (gameState.aiTokens ?? 0);
        const clampedDelta = Math.max(-5, Math.min(5, tokenDelta));
        const heroMatchupKey = `${gameState.playerHero}vs${gameState.aiHero}`;
        const contextKey = `${playerCard.element} ${playerCard.wert}|${gameState.weather}|${heroMatchupKey}|delta:${clampedDelta}`;
        const possiblePlays = modelData.get(contextKey);
        const metadata = contextMetadata.get(contextKey);

        const options = generateAiPlayOptions(playerCard, aiHand, {
            ...gameState,
            aiHandPreview: gameState.aiHandPreview ?? aiHand,
        });

        const fallbackDecision = (): AiPlayDecision => {
            const sorted = [...options].sort((a, b) => b.score - a.score);
            const topScore = sorted[0]?.score ?? 0;
            const nearTop = sorted.filter(option => Math.abs(option.score - topScore) < 0.5);
            const pool = nearTop.length > 0 ? nearTop : sorted;
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            return chosen.decision;
        };

        if (!possiblePlays || possiblePlays.size === 0 || options.length === 0) {
            return fallbackDecision();
        }

        const baseline = metadata?.baselineWinRate ?? 0.45;
        const defaultLower = Math.max(0, baseline - 0.25);
        const defaultUpper = Math.min(1, baseline + 0.15);

        const summaryByKey = new Map<string, {
            option: ReturnType<typeof generateAiPlayOptions>[number];
            winRate: number;
            wilsonLower: number;
            wilsonUpper: number;
            intervalWidth: number;
            observations: number;
            evidence: number;
        }>();

        options.forEach(option => {
            const key = `${option.decision.card.element} ${option.decision.card.wert}`;
            const stats = possiblePlays.get(key);
            const interval = stats && stats.total > 0
                ? wilsonInterval(stats.wins, stats.total)
                : { lower: defaultLower, upper: defaultUpper, width: defaultUpper - defaultLower };
            const winRate = stats && stats.total > 0 ? stats.wins / stats.total : baseline;
            const observations = stats?.total ?? 0;
            const evidence = computeEvidenceScore(interval.lower, interval.upper);

            const existing = summaryByKey.get(key);
            if (!existing || option.score > existing.option.score) {
                summaryByKey.set(key, {
                    option,
                    winRate,
                    wilsonLower: interval.lower,
                    wilsonUpper: interval.upper,
                    intervalWidth: interval.width,
                    observations,
                    evidence,
                });
            }
        });

        if (summaryByKey.size === 0) {
            return fallbackDecision();
        }

        const ranked = Array.from(summaryByKey.values()).sort((a, b) => {
            if (b.wilsonLower !== a.wilsonLower) {
                return b.wilsonLower - a.wilsonLower;
            }
            if (b.evidence !== a.evidence) {
                return b.evidence - a.evidence;
            }
            if (b.observations !== a.observations) {
                return b.observations - a.observations;
            }
            return b.option.score - a.option.score;
        });

        const best = ranked[0];
        if (!best) {
            return fallbackDecision();
        }

        if (metadata?.consolidationStage === 'stable') {
            const entropyLow = (metadata.entropy ?? 1) < 0.3;
            if (entropyLow && ranked.length > 1) {
                const second = ranked[1];
                if (second) {
                    const mixChance = 0.15;
                    return Math.random() < mixChance ? second.option.decision : best.option.decision;
                }
            }
            return best.option.decision;
        }

        let temperature = metadata?.consolidationStage === 'provisional' ? 1.0 : 1.4;
        if ((metadata?.entropy ?? 1) < 0.3) {
            temperature += 0.4;
        }

        const maxScore = Math.max(...ranked.map(entry => entry.wilsonLower));
        const weights = ranked.map(entry => Math.exp((entry.wilsonLower - maxScore) / Math.max(0.4, temperature)));
        const weightSum = weights.reduce((sum, value) => sum + value, 0);
        if (!isFinite(weightSum) || weightSum === 0) {
            return best.option.decision;
        }

        let threshold = Math.random() * weightSum;
        for (let i = 0; i < ranked.length; i++) {
            threshold -= weights[i];
            if (threshold <= 0) {
                return ranked[i].option.decision;
            }
        }

        return best.option.decision;
    };

    return { predict, analysis };
}
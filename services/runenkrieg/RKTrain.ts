import {
    Card,
    RoundResult,
    FusionDecisionSample,
    TrainedModel,
    TrainingAnalysis,
    TrainingRunOptions,
    ContextInsight,
    TokenDeltaCoverage,
    HeroMatchupInsight,
    ElementCounterInsight,
    MechanicEffectivenessInsight,
    ResamplingRecommendation,
    SerializedRunenkriegModel,
    RunenkriegContextMetadata,
    FusionInsight,
    WeatherType,
    HeroName,
    ElementType,
    AbilityMechanicName,
} from '../../types';
import { ABILITIES, ABILITY_MECHANICS, HEROES, ELEMENT_HIERARCHIE } from '../../constants';
import { computeWilsonStatsGpu } from '../gpuAcceleration';
import {
    clampTokenDelta,
    parseCardLabel,
    FOCUS_CONTEXT_INDEX,
    wilsonInterval,
    computeEvidenceScore,
    computeEntropy,
    determineWave,
    assignPriority,
} from './RKCommon';
export const RUNENKRIEG_MODEL_VERSION = 1;

const waitFor = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

type ContextMetadata = RunenkriegContextMetadata;
const GPU_WILSON_STRIDE = 5;
const INITIALIZATION_PROGRESS_SHARE = 0.05;
const MIN_SIMULATION_PROGRESS_STEPS = 40;
const MIN_CONTEXT_PROGRESS_STEPS = 30;

const computeYieldInterval = (total: number, desiredSteps: number) =>
    Math.max(1, Math.floor(Math.max(1, total) / Math.max(1, desiredSteps)));

const yieldDuringTraining = async (iteration: number, interval: number) => {
    if (interval > 0 && iteration % interval === 0) {
        await waitFor(0);
    }
};

// This builds a model: for each (player card + weather), what AI card has the best win rate?
export async function trainModel(
    simulationData: RoundResult[],
    options: TrainingRunOptions = {}
): Promise<TrainedModel> {
    const { onProgress, preferGpu = false, baseModel } = options;
    const modelData = new Map<string, Map<string, { wins: number; total: number }>>();
    const contextMetadata = new Map<string, ContextMetadata>();
    const hasBaseModel = Boolean(baseModel);
    const fusionSamples: FusionDecisionSample[] = [];

    if (baseModel) {
        try {
            const { modelData: existingData, metadataMap } = inflateSerializedRunenkriegModel(baseModel);
            existingData.forEach((aiMap, contextKey) => {
                const clonedMap = new Map<string, { wins: number; total: number }>();
                aiMap.forEach((stats, cardKey) => {
                    clonedMap.set(cardKey, { wins: stats.wins, total: stats.total });
                });
                modelData.set(contextKey, clonedMap);
            });
            metadataMap.forEach((metadata, contextKey) => {
                contextMetadata.set(contextKey, {
                    ...metadata,
                    preferredResponses: metadata.preferredResponses
                        ? [...metadata.preferredResponses]
                        : undefined,
                });
            });
        } catch (error) {
            console.warn('Fortführung des vorhandenen Runenkrieg-Modells fehlgeschlagen:', error);
        }
    }

    for (const [contextKey, focusDetails] of FOCUS_CONTEXT_INDEX.entries()) {
        if (!modelData.has(contextKey)) {
            modelData.set(contextKey, new Map());
        }
        const aiCardMap = modelData.get(contextKey)!;
        focusDetails.forEach((detail) => {
            let stats = aiCardMap.get(detail.aiCard);
            let isNewEntry = false;
            if (!stats) {
                stats = { wins: 0, total: 0 };
                aiCardMap.set(detail.aiCard, stats);
                isNewEntry = true;
            }
            if (!hasBaseModel || isNewEntry) {
                const priorWins = Math.round(detail.priorWeight * detail.targetAiWinRate);
                stats.total += detail.priorWeight;
                stats.wins += priorWins;
            }
        });
    }

    onProgress?.({
        phase: 'initializing',
        progress: INITIALIZATION_PROGRESS_SHARE,
        message: 'Kontextbasierte Priors initialisiert.',
    });

    const totalRounds = simulationData.length;
    const safeTotalRounds = Math.max(1, totalRounds);
    const simulationYieldInterval = computeYieldInterval(totalRounds, MIN_SIMULATION_PROGRESS_STEPS);
    const aggregationShare = totalRounds > 0 ? 0.45 : 0;
    const analysisShare = Math.max(0, 1 - INITIALIZATION_PROGRESS_SHARE - aggregationShare);

    for (let i = 0; i < totalRounds; i++) {
        const round = simulationData[i];
        if (round.fusionDecisions) {
            fusionSamples.push(...round.fusionDecisions);
        }
        // UPDATED: Context-aware key
        const tokenDelta = round.spieler_token_vorher - round.gegner_token_vorher;
        const clampedDelta = clampTokenDelta(tokenDelta);
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

        if ((i + 1) % simulationYieldInterval === 0 || i === totalRounds - 1) {
            const ratio = (i + 1) / safeTotalRounds;
            onProgress?.({
                phase: 'aggregating',
                progress: INITIALIZATION_PROGRESS_SHARE + aggregationShare * ratio,
                message: `Verarbeite Simulation ${i + 1} von ${safeTotalRounds}`,
            });
            await yieldDuringTraining(i + 1, simulationYieldInterval);
        }
    }

    if (totalRounds === 0) {
        onProgress?.({
            phase: 'aggregating',
            progress: INITIALIZATION_PROGRESS_SHARE,
            message: 'Keine Simulationsdaten – nutze Fokus-Prioren.',
        });
    } else {
        onProgress?.({
            phase: 'aggregating',
            progress: INITIALIZATION_PROGRESS_SHARE + aggregationShare,
            message: 'Simulationen verarbeitet. Starte Kontextanalyse...',
        });
    }

    let contextsWithSolidData = 0;
    let contextsNeedingData = 0;
    let winRateSum = 0;
    let contextsWithBestCard = 0;
    let bestContext: TrainingAnalysis['bestContext'] | undefined = undefined;

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
    const entropyAlerts: ContextInsight[] = [];
    const contextEntries = Array.from(modelData.entries());
    const contextEntryCount = contextEntries.length;
    const safeContextTotal = Math.max(1, contextEntryCount);
    const contextYieldInterval = computeYieldInterval(contextEntryCount, MIN_CONTEXT_PROGRESS_STEPS);
    let gpuUtilized = false;
    let gpuAvailableForContexts = preferGpu;

    for (let contextIndex = 0; contextIndex < contextEntryCount; contextIndex++) {
        const [contextKey, aiCardMap] = contextEntries[contextIndex];
        const [playerCardLabel, weatherString, heroMatchupString, deltaString] = contextKey.split('|');
        const weather = weatherString as WeatherType;
        const [playerHero, aiHero] = heroMatchupString.split('vs') as [HeroName, HeroName];
        const tokenDelta = Number(deltaString.replace('delta:', ''));
        const { element: playerElement } = parseCardLabel(playerCardLabel);

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

        const statsList: Array<{ key: string; stats: { wins: number; total: number } }> = [];
        aiCardMap.forEach((stats, cardKey) => {
            statsList.push({ key: cardKey, stats });
        });

        const winsArray = new Float32Array(statsList.length);
        const totalsArray = new Float32Array(statsList.length);
        for (let idx = 0; idx < statsList.length; idx++) {
            winsArray[idx] = statsList[idx].stats.wins;
            totalsArray[idx] = statsList[idx].stats.total;
        }

        let gpuStats: Float32Array | null = null;
        if (gpuAvailableForContexts && statsList.length >= 4) {
            try {
                gpuStats = await computeWilsonStatsGpu(winsArray, totalsArray);
                if (gpuStats) {
                    gpuUtilized = true;
                } else {
                    gpuAvailableForContexts = false;
                }
            } catch (error) {
                console.warn('GPU-gestützte Kontextauswertung fehlgeschlagen, wechsle zu CPU.', error);
                gpuAvailableForContexts = false;
                gpuStats = null;
            }
        }

        for (let idx = 0; idx < statsList.length; idx++) {
            const { key: cardKey, stats } = statsList[idx];
            if (stats.total === 0) {
                continue;
            }

            totalTrials += stats.total;
            totalWins += stats.wins;

            let winRate: number;
            let wilsonLower: number;
            let wilsonUpper: number;
            let intervalWidth: number;
            let evidenceScoreValue: number;

            if (gpuStats && gpuStats.length >= (idx + 1) * GPU_WILSON_STRIDE) {
                const baseIndex = idx * GPU_WILSON_STRIDE;
                winRate = gpuStats[baseIndex];
                wilsonLower = gpuStats[baseIndex + 1];
                wilsonUpper = gpuStats[baseIndex + 2];
                intervalWidth = gpuStats[baseIndex + 3];
                evidenceScoreValue = gpuStats[baseIndex + 4];
            } else {
                const interval = wilsonInterval(stats.wins, stats.total);
                winRate = stats.wins / stats.total;
                wilsonLower = interval.lower;
                wilsonUpper = interval.upper;
                intervalWidth = interval.width;
                evidenceScoreValue = computeEvidenceScore(interval.lower, interval.upper);
            }

            candidateSummaries.push({
                cardKey,
                wins: stats.wins,
                total: stats.total,
                winRate,
                wilsonLower,
                wilsonUpper,
                intervalWidth,
                evidenceScore: evidenceScoreValue,
            });

            const { ability: aiAbility } = parseCardLabel(cardKey);
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

        const focusEntries = FOCUS_CONTEXT_INDEX.get(contextKey);
        let weaknessPenalty = 0;
        if (focusEntries && focusEntries.length > 0) {
            weaknessPenalty = 0.1;
            if (bestCandidate.winRate < 0.5) {
                weaknessPenalty += 0.05;
            }
        } else if (tokenDelta >= 4 && bestCandidate.winRate < 0.55) {
            weaknessPenalty = Math.min(0.15, (0.55 - bestCandidate.winRate) * 0.6);
        }
        if (bestCandidate.winRate < baselineWinRate) {
            weaknessPenalty += 0.03;
        }
        weaknessPenalty = Math.min(0.3, Math.max(0, weaknessPenalty));

        contextMetadata.set(contextKey, {
            bestCardKey: bestCandidate.cardKey,
            observations: bestCandidate.total,
            wilsonLower: bestCandidate.wilsonLower,
            wilsonUpper: bestCandidate.wilsonUpper,
            entropy,
            baselineWinRate,
            bestWinRate: bestCandidate.winRate,
            consolidationStage,
            weaknessPenalty,
            preferredResponses: focusEntries?.map((entry) => entry.aiCard),
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

        const ratio = (contextIndex + 1) / safeContextTotal;
        const progressValue = INITIALIZATION_PROGRESS_SHARE + aggregationShare + analysisShare * ratio;
        const gpuMessage = preferGpu
            ? gpuUtilized
                ? 'Analysiere Kontexte (GPU aktiv)'
                : 'Analysiere Kontexte (GPU bevorzugt)'
            : 'Analysiere Kontexte';
        onProgress?.({
            phase: 'analyzing',
            progress: Math.min(0.999, progressValue),
            message: `${gpuMessage} – ${contextIndex + 1}/${safeContextTotal}`,
        });
        await yieldDuringTraining(contextIndex + 1, contextYieldInterval);
    }

    const totalContexts = contextDetails.length;
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

    const fusionInsights = buildFusionInsights(fusionSamples);

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
        fusionInsights,
    };

    const trainedModel = buildRunenkriegModel(modelData, contextMetadata, analysis);

    const finalMessage = preferGpu
        ? gpuUtilized
            ? 'Training abgeschlossen. GPU-Beschleunigung aktiv.'
            : 'Training abgeschlossen. GPU nicht verfügbar – CPU genutzt.'
        : 'Training abgeschlossen.';
    onProgress?.({ phase: 'finalizing', progress: 1, message: finalMessage });

    return trainedModel;
}

function inflateSerializedRunenkriegModel(
    serialized: SerializedRunenkriegModel
): {
    modelData: Map<string, Map<string, { wins: number; total: number }>>;
    metadataMap: Map<string, ContextMetadata>;
} {
    const modelData = new Map<string, Map<string, { wins: number; total: number }>>();
    const metadataMap = new Map<string, ContextMetadata>();

    const entries = Object.entries(serialized.contexts ?? {});
    for (const [contextKey, contextValue] of entries) {
        const aiMap = new Map<string, { wins: number; total: number }>();
        const cardEntries = Object.entries(contextValue?.aiCards ?? {});
        for (const [cardKey, stats] of cardEntries) {
            aiMap.set(cardKey, { wins: stats.wins, total: stats.total });
        }
        modelData.set(contextKey, aiMap);

        if (contextValue?.metadata) {
            metadataMap.set(contextKey, {
                ...contextValue.metadata,
                preferredResponses: contextValue.metadata.preferredResponses
                    ? [...contextValue.metadata.preferredResponses]
                    : undefined,
            });
        }
    }

    return { modelData, metadataMap };
}

function buildRunenkriegModel(
    modelData: Map<string, Map<string, { wins: number; total: number }>>,
    contextMetadata: Map<string, ContextMetadata>,
    analysis: TrainingAnalysis
): TrainedModel {
    const predict = (playerCard: Card, aiHand: Card[], gameState: any): Card => {
        const tokenDelta = (gameState.playerTokens ?? 0) - (gameState.aiTokens ?? 0);
        const clampedDelta = clampTokenDelta(tokenDelta);
        const heroMatchupKey = `${gameState.playerHero}vs${gameState.aiHero}`;
        const contextKey = `${playerCard.element} ${playerCard.wert}|${gameState.weather}|${heroMatchupKey}|delta:${clampedDelta}`;
        const possiblePlays = modelData.get(contextKey);
        const metadata = contextMetadata.get(contextKey);

        if (!possiblePlays || aiHand.length === 0) {
            const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
            return sortedHand[0] || aiHand[Math.floor(Math.random() * aiHand.length)];
        }

        const baseline = metadata?.baselineWinRate ?? 0.45;
        const defaultLower = Math.max(0, baseline - 0.25);
        const defaultUpper = Math.min(1, baseline + 0.15);

        const weaknessPenalty = metadata?.weaknessPenalty ?? 0;
        const preferredResponses = metadata?.preferredResponses ?? [];

        const candidateSummaries = aiHand.map((card) => {
            const key = `${card.element} ${card.wert}`;
            const stats = possiblePlays.get(key);
            if (!stats || stats.total === 0) {
                const isPreferred = preferredResponses.includes(key);
                const baseLower = defaultLower;
                const adjustedLower = Math.min(
                    1,
                    Math.max(0, baseLower - weaknessPenalty + (isPreferred ? 0.08 : 0))
                );
                return {
                    card,
                    key,
                    winRate: baseline,
                    wilsonLower: baseLower,
                    wilsonUpper: Math.min(1, defaultUpper + (isPreferred ? 0.05 : 0)),
                    intervalWidth: defaultUpper - defaultLower,
                    observations: stats?.total ?? 0,
                    adjustedLower,
                    isPreferred,
                };
            }
            const interval = wilsonInterval(stats.wins, stats.total);
            const isPreferred = preferredResponses.includes(key);
            const adjustedLower = Math.min(
                1,
                Math.max(0, interval.lower - weaknessPenalty + (isPreferred ? 0.08 : 0))
            );
            return {
                card,
                key,
                winRate: stats.wins / stats.total,
                wilsonLower: interval.lower,
                wilsonUpper: Math.min(1, interval.upper + (isPreferred ? 0.05 : 0)),
                intervalWidth: interval.width,
                observations: stats.total,
                adjustedLower,
                isPreferred,
            };
        });

        const sortedByEvidence = [...candidateSummaries].sort((a, b) => {
            if (b.adjustedLower !== a.adjustedLower) {
                return b.adjustedLower - a.adjustedLower;
            }
            if (a.isPreferred !== b.isPreferred) {
                return (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0);
            }
            return b.wilsonLower - a.wilsonLower;
        });
        const topCandidate = sortedByEvidence[0];
        if (!topCandidate) {
            const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
            return sortedHand[0];
        }

        const entropyLow = (metadata?.entropy ?? 1) < 0.3;
        if (metadata?.consolidationStage === 'stable') {
            if (entropyLow && sortedByEvidence.length > 1) {
                const secondCandidate = sortedByEvidence[1];
                const mixChance = 0.15;
                return Math.random() < mixChance ? secondCandidate.card : topCandidate.card;
            }
            return topCandidate.card;
        }

        let temperature = metadata?.consolidationStage === 'provisional' ? 1.0 : 1.4;
        if (entropyLow) {
            temperature += 0.4;
        }

        if (weaknessPenalty > 0) {
            temperature += weaknessPenalty * 2.5;
        }

        const adjustedScores = sortedByEvidence.map((entry) => entry.adjustedLower);
        const maxScore = adjustedScores.length > 0 ? Math.max(...adjustedScores) : 0;
        const weights = sortedByEvidence.map((entry) =>
            Math.exp((entry.adjustedLower - maxScore) / Math.max(0.4, temperature))
        );
        const weightSum = weights.reduce((sum, value) => sum + value, 0);
        if (weightSum === 0) {
            return topCandidate.card;
        }

        let threshold = Math.random() * weightSum;
        for (let i = 0; i < sortedByEvidence.length; i++) {
            threshold -= weights[i];
            if (threshold <= 0) {
                return sortedByEvidence[i].card;
            }
        }

        return topCandidate.card;
    };

    const serialize = (): SerializedRunenkriegModel => {
        const contexts: SerializedRunenkriegModel['contexts'] = {};
        modelData.forEach((aiCardMap, contextKey) => {
            const aiCards: Record<string, { wins: number; total: number }> = {};
            aiCardMap.forEach((stats, cardKey) => {
                aiCards[cardKey] = { wins: stats.wins, total: stats.total };
            });
            const metadata = contextMetadata.get(contextKey);
            contexts[contextKey] = {
                aiCards,
                ...(metadata
                    ? {
                          metadata: {
                              ...metadata,
                              preferredResponses: metadata.preferredResponses
                                  ? [...metadata.preferredResponses]
                                  : undefined,
                          },
                      }
                    : {}),
            };
        });

        return {
            version: RUNENKRIEG_MODEL_VERSION,
            generatedAt: new Date().toISOString(),
            contexts,
            analysis: JSON.parse(JSON.stringify(analysis)) as TrainingAnalysis,
        };
    };

    return { predict, analysis, serialize };
}

export function hydrateTrainedModel(serialized: SerializedRunenkriegModel): TrainedModel {
    if (!serialized || typeof serialized !== 'object') {
        throw new Error('Ungültiges Runenkrieg-Modellformat.');
    }

    if (serialized.version !== RUNENKRIEG_MODEL_VERSION) {
        console.warn(
            `Geladenes Runenkrieg-Modell hat Version ${serialized.version}, erwartet ${RUNENKRIEG_MODEL_VERSION}.`
        );
    }

    const { modelData, metadataMap } = inflateSerializedRunenkriegModel(serialized);

    return buildRunenkriegModel(modelData, metadataMap, serialized.analysis);
}

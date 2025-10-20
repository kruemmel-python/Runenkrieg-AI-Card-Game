import {
    Card,
    FusionDecisionSample,
    GameHistoryEntry,
    HeroName,
    RoundResult,
    WeatherType,
    Winner,
} from '../../types';
import {
    ABILITIES,
    ABILITY_MECHANICS,
    CARD_TYPES,
    ELEMENTS,
    ELEMENT_HIERARCHIE,
    HEROES,
    HAND_SIZE,
    START_TOKENS,
    WEATHER_EFFECTS,
} from '../../constants';
import {
    evaluateElementSynergy,
    evaluateRiskAndWeather,
    resolveMechanicEffects,
} from '../mechanicEngine';
import { buildShuffledDeck, getRandomCardTemplate } from '../cardCatalogService';
import {
    FocusContextDetail,
    WEAK_CONTEXT_FOCUS,
} from './contextFocus';
import { RKFusionEngine } from './RKFusionEngine';
import { BanditPolicy } from './policy/BanditPolicy';
import { FusionDecision, RKFusionOutcome } from './policy/RKFusionPolicy';

const MAX_ROUNDS_PER_GAME = 200;

const parseCardLabel = (
    cardLabel: string
): { element: Card['element']; ability: Card['wert'] } => {
    const [element, ...abilityParts] = cardLabel.split(' ');
    return {
        element: element as Card['element'],
        ability: abilityParts.join(' ') as Card['wert'],
    };
};

const createCardTemplate = (label: string, idSuffix: string): Card => {
    const { element, ability } = parseCardLabel(label);
    const elementIndex = ELEMENTS.indexOf(element);
    const abilityIndex = ABILITIES.indexOf(ability);
    const cardType = CARD_TYPES[(elementIndex + abilityIndex) % CARD_TYPES.length];

    return {
        element,
        wert: ability,
        id: `${element}-${ability}-${idSuffix}`,
        cardType: cardType.name,
        mechanics: ABILITY_MECHANICS[ability] || [],
        lifespan: cardType.defaultLifespan,
        charges: cardType.defaultCharges,
        origin: 'core',
    };
};

const abilityIndex = (value: Card['wert']) => ABILITIES.indexOf(value);

const generateReplacementCard = (ownerLabel: 'spieler' | 'gegner'): Card => {
    const template = getRandomCardTemplate();
    return {
        ...template,
        id: `${template.id}-${ownerLabel}-generated-${Date.now()}`,
        origin: 'generated',
    };
};

const ensureHandSize = (
    hand: Card[],
    talon: Card[],
    ownerLabel: 'spieler' | 'gegner'
): void => {
    while (hand.length < HAND_SIZE) {
        if (talon.length > 0) {
            hand.push(talon.pop()!);
        } else {
            hand.push(generateReplacementCard(ownerLabel));
        }
    }
};

const createHandSignature = (hand: Card[]) =>
    hand
        .map((card) => `${card.element}-${card.wert}`)
        .sort()
        .join('|');

const calculateTotalValueInSim = (
    ownCard: Card,
    opponentCard: Card,
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    currentWeather: WeatherType,
    handSnapshot: Card[],
    history: GameHistoryEntry[],
    owner: 'spieler' | 'gegner'
): number => {
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
};

const applyElementEffect = (
    winner: Winner,
    winnerCard: Card,
    pTokens: number,
    aTokens: number,
    historyLength: number
): [number, number] => {
    let newPlayerTokens = pTokens;
    let newAiTokens = aTokens;
    if (winner !== 'unentschieden') {
        switch (winnerCard.element) {
            case 'Feuer':
                winner === 'spieler' ? newAiTokens-- : newPlayerTokens--;
                break;
            case 'Wasser':
                winner === 'spieler'
                    ? (newPlayerTokens++, newAiTokens--)
                    : (newAiTokens++, newPlayerTokens--);
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
                const chaosSwing = (historyLength + 1) % 2 === 0 ? 1 : -1;
                if (chaosSwing > 0) {
                    if (winner === 'spieler') {
                        newPlayerTokens++;
                        newAiTokens = Math.max(0, newAiTokens - 1);
                    } else {
                        newAiTokens++;
                        newPlayerTokens = Math.max(0, newPlayerTokens - 1);
                    }
                } else if (winner === 'spieler') {
                    newPlayerTokens = Math.max(0, newPlayerTokens - 1);
                    newAiTokens++;
                } else {
                    newAiTokens = Math.max(0, newAiTokens - 1);
                    newPlayerTokens++;
                }
                break;
            }
        }
    }
    return [newPlayerTokens, newAiTokens];
};

const determineWinnerInSim = (
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
): Winner => {
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

    if (playerTotal > aiTotal + 0.5) {
        return 'spieler';
    }
    if (aiTotal > playerTotal + 0.5) {
        return 'gegner';
    }
    return 'unentschieden';
};

const scoreCardForSelection = (
    card: Card,
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    weather: WeatherType,
    hand: Card[],
    history: GameHistoryEntry[],
    owner: 'spieler' | 'gegner'
): number => {
    const baseStrength = abilityIndex(card.wert);
    const riskWeather = evaluateRiskAndWeather(card, ownTokens, opponentTokens, weather);
    const heroBonus = HEROES[hero].Element === card.element ? HEROES[hero].Bonus : 0;
    const remainingHand = hand.filter((handCard) => handCard.id !== card.id);
    const synergyBonus = evaluateElementSynergy(
        card,
        remainingHand,
        history,
        owner === 'spieler' ? 'player' : 'ai'
    );
    const mechanicBonus =
        (card.mechanics.includes('Fusion') ? 2 : 0) +
        (card.mechanics.includes('Ketteneffekte') ? 0.8 : 0) +
        (card.mechanics.includes('Elementarresonanz') ? 0.5 : 0);

    return baseStrength + riskWeather + heroBonus + synergyBonus + mechanicBonus;
};

const selectCardForSimulation = (
    hand: Card[],
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    weather: WeatherType,
    history: GameHistoryEntry[],
    owner: 'spieler' | 'gegner'
): { card: Card; index: number } => {
    if (hand.length === 1) {
        return { card: hand[0], index: 0 };
    }

    const scores = hand.map((card) =>
        Math.max(
            0.1,
            scoreCardForSelection(card, hero, ownTokens, opponentTokens, weather, hand, history, owner)
        )
    );
    const totalScore = scores.reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * totalScore;

    for (let i = 0; i < hand.length; i++) {
        roll -= scores[i];
        if (roll <= 0) {
            return { card: hand[i], index: i };
        }
    }

    const lastIndex = hand.length - 1;
    return { card: hand[lastIndex], index: lastIndex };
};

const simulateFocusedRound = (
    detail: FocusContextDetail,
    seed: number
): RoundResult => {
    const playerTemplate = createCardTemplate(detail.playerCard, `focus-player-${seed}`);
    const aiTemplate = createCardTemplate(detail.aiCard, `focus-ai-${seed}`);

    const weather = detail.weather;
    const playerHero = detail.playerHero;
    const aiHero = detail.aiHero;

    const playerHandSnapshot = [playerTemplate];
    const aiHandSnapshot = [aiTemplate];

    const history: GameHistoryEntry[] = [];
    const playerTokensBefore = START_TOKENS + detail.tokenDelta;
    const aiTokensBefore = START_TOKENS;

    const winner = determineWinnerInSim(
        playerTemplate,
        aiTemplate,
        playerHero,
        aiHero,
        playerTokensBefore,
        aiTokensBefore,
        weather,
        playerHandSnapshot,
        aiHandSnapshot,
        history
    );

    let playerTokensAfter = playerTokensBefore;
    let aiTokensAfter = aiTokensBefore;

    const winnerCard = winner === 'spieler' ? playerTemplate : aiTemplate;
    [playerTokensAfter, aiTokensAfter] = applyElementEffect(
        winner,
        winnerCard,
        playerTokensAfter,
        aiTokensAfter,
        history.length
    );

    const mechanicOutcome = resolveMechanicEffects({
        winner,
        playerCard: playerTemplate,
        aiCard: aiTemplate,
        weather,
        remainingPlayerHand: playerHandSnapshot,
        remainingAiHand: aiHandSnapshot,
        basePlayerTokens: playerTokensAfter,
        baseAiTokens: aiTokensAfter,
        history,
    });

    playerTokensAfter = Math.max(0, mechanicOutcome.playerTokens);
    aiTokensAfter = Math.max(0, mechanicOutcome.aiTokens);

    return {
        spieler_karte: detail.playerCard,
        gegner_karte: detail.aiCard,
        spieler_token_vorher: playerTokensBefore,
        gegner_token_vorher: aiTokensBefore,
        spieler_token: playerTokensAfter,
        gegner_token: aiTokensAfter,
        wetter: detail.weather,
        spieler_held: detail.playerHero,
        gegner_held: detail.aiHero,
        gewinner: winner,
    };
};

export interface SimulationOptions {
    chunkSize?: number;
    yieldDelayMs?: number;
    onProgress?: (completedGames: number, totalGames: number) => void;
    signal?: AbortSignal;
}

const DEFAULT_SIMULATION_YIELD_DELAY_MS = 16;

const waitFor = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

const ensureSimulationNotAborted = (signal?: AbortSignal) => {
    if (signal?.aborted) {
        const reason = signal.reason ?? 'Simulation abgebrochen.';
        throw reason instanceof Error ? reason : new Error(String(reason));
    }
};

const yieldToBrowser = async (
    step: number,
    chunkSize: number,
    delayMs: number,
    signal?: AbortSignal
) => {
    ensureSimulationNotAborted(signal);
    if (step % chunkSize === 0) {
        await waitFor(delayMs);
        ensureSimulationNotAborted(signal);
    }
};

const augmentWithFocusRounds = async (
    numGames: number,
    data: RoundResult[],
    controls: { chunkSize: number; yieldDelayMs: number; signal?: AbortSignal }
): Promise<void> => {
    const baseGames = Math.max(1, numGames);
    let produced = 0;
    for (let index = 0; index < WEAK_CONTEXT_FOCUS.length; index++) {
        const detail = WEAK_CONTEXT_FOCUS[index];
        const samples = Math.max(3, Math.round(baseGames * detail.sampleRate));
        for (let i = 0; i < samples; i++) {
            ensureSimulationNotAborted(controls.signal);
            data.push(simulateFocusedRound(detail, index * 1000 + i));
            produced += 1;
            if (produced % controls.chunkSize === 0) {
                await yieldToBrowser(produced, controls.chunkSize, controls.yieldDelayMs, controls.signal);
            }
        }
    }

    if (produced % controls.chunkSize !== 0) {
        await yieldToBrowser(produced, controls.chunkSize, controls.yieldDelayMs, controls.signal);
    }
};

export async function simulateGames(
    numGames: number,
    options: SimulationOptions = {}
): Promise<RoundResult[]> {
    const {
        chunkSize: requestedChunkSize,
        yieldDelayMs = DEFAULT_SIMULATION_YIELD_DELAY_MS,
        onProgress,
        signal,
    } = options;

    const computedChunk = Math.ceil(Math.max(1, numGames) / 25);
    const chunkSize = Math.max(1, requestedChunkSize ?? computedChunk);
    const delay = Math.max(0, yieldDelayMs);

    const allData: RoundResult[] = [];
    const heroNames = Object.keys(HEROES) as HeroName[];

    const simFusionEngine = new RKFusionEngine(new BanditPolicy());

    for (let i = 0; i < numGames; i++) {
        ensureSimulationNotAborted(signal);
        const deck = buildShuffledDeck();
        let playerHand = deck.slice(0, 4);
        let aiHand = deck.slice(4, 8);
        let talon = deck.slice(8);
        let playerTokens = START_TOKENS;
        let aiTokens = START_TOKENS;
        let roundsPlayed = 0;

        const playerHero = heroNames[Math.floor(Math.random() * heroNames.length)];
        const aiHero = heroNames[Math.floor(Math.random() * heroNames.length)];

        const history: GameHistoryEntry[] = [];

        ensureHandSize(playerHand, talon, 'spieler');
        ensureHandSize(aiHand, talon, 'gegner');

        while (
            playerTokens > 0 &&
            aiTokens > 0 &&
            playerHand.length > 0 &&
            aiHand.length > 0 &&
            roundsPlayed < MAX_ROUNDS_PER_GAME
        ) {
            const weather = Object.keys(WEATHER_EFFECTS)[
                Math.floor(Math.random() * Object.keys(WEATHER_EFFECTS).length)
            ] as WeatherType;

            const roundFusionDecisions: FusionDecisionSample[] = [];
            const currentRoundDecisions: { actor: 'spieler' | 'gegner'; decision: FusionDecision }[] = [];

            const playerFusionResult = simFusionEngine.decideAndExecute(
                playerHand,
                playerHero,
                aiHero,
                playerTokens,
                aiTokens,
                weather,
                roundsPlayed + 1,
                history,
                'spieler'
            );

            playerHand = playerFusionResult.updatedHand;
            if (playerFusionResult.decision) {
                currentRoundDecisions.push({ actor: 'spieler', decision: playerFusionResult.decision });
                roundFusionDecisions.push({
                    actor: 'spieler',
                    hero: playerHero,
                    opponentHero: aiHero,
                    weather,
                    tokenDelta: playerFusionResult.decision.ctx.boardSummary.tokenDiff,
                    handSignature: createHandSignature(playerFusionResult.updatedHand),
                    fusedCard: playerFusionResult.fusedCard
                        ? `${playerFusionResult.fusedCard.element} ${playerFusionResult.fusedCard.wert}`
                        : null,
                    gain: playerFusionResult.decision.ctx.candidate.projectedGain,
                    decision: playerFusionResult.decision.action,
                    synergyScore: playerFusionResult.decision.ctx.candidate.synergyScore,
                    weatherScore: playerFusionResult.decision.ctx.candidate.weatherScore,
                    historyPressure: playerFusionResult.decision.ctx.boardSummary.ownMorale,
                });
            }
            if (playerFusionResult.isFused) {
                ensureHandSize(playerHand, talon, 'spieler');
            }

            const aiFusionResult = simFusionEngine.decideAndExecute(
                aiHand,
                aiHero,
                playerHero,
                aiTokens,
                playerTokens,
                weather,
                roundsPlayed + 1,
                history,
                'gegner'
            );

            aiHand = aiFusionResult.updatedHand;
            if (aiFusionResult.decision) {
                currentRoundDecisions.push({ actor: 'gegner', decision: aiFusionResult.decision });
                roundFusionDecisions.push({
                    actor: 'gegner',
                    hero: aiHero,
                    opponentHero: playerHero,
                    weather,
                    tokenDelta: aiFusionResult.decision.ctx.boardSummary.tokenDiff,
                    handSignature: createHandSignature(aiFusionResult.updatedHand),
                    fusedCard: aiFusionResult.fusedCard
                        ? `${aiFusionResult.fusedCard.element} ${aiFusionResult.fusedCard.wert}`
                        : null,
                    gain: aiFusionResult.decision.ctx.candidate.projectedGain,
                    decision: aiFusionResult.decision.action,
                    synergyScore: aiFusionResult.decision.ctx.candidate.synergyScore,
                    weatherScore: aiFusionResult.decision.ctx.candidate.weatherScore,
                    historyPressure: aiFusionResult.decision.ctx.boardSummary.ownMorale,
                });
            }
            if (aiFusionResult.isFused) {
                ensureHandSize(aiHand, talon, 'gegner');
            }

            ensureHandSize(playerHand, talon, 'spieler');
            ensureHandSize(aiHand, talon, 'gegner');

            const playerSelection = selectCardForSimulation(
                playerHand,
                playerHero,
                playerTokens,
                aiTokens,
                weather,
                history,
                'spieler'
            );
            const playerCard = playerHand.splice(playerSelection.index, 1)[0];

            const aiSelection = selectCardForSimulation(
                aiHand,
                aiHero,
                aiTokens,
                playerTokens,
                weather,
                history,
                'gegner'
            );
            const aiCard = aiHand.splice(aiSelection.index, 1)[0];

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

            const winnerCard = winner === 'spieler' ? playerCard : aiCard;
            [playerTokens, aiTokens] = applyElementEffect(
                winner,
                winnerCard,
                playerTokens,
                aiTokens,
                history.length
            );

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

            playerTokens = Math.max(0, mechanicOutcome.playerTokens);
            aiTokens = Math.max(0, mechanicOutcome.aiTokens);

            const playerTokensAfter = playerTokens;
            const aiTokensAfter = aiTokens;

            const finalTokenDiff = playerTokensAfter - aiTokensAfter;
            const baseOutcome: RKFusionOutcome['roundWinner'] =
                winner === 'spieler' ? 'self' : winner === 'gegner' ? 'opponent' : 'draw';

            for (const { actor, decision } of currentRoundDecisions) {
                const actorOutcome: RKFusionOutcome = {
                    roundWinner:
                        actor === 'spieler'
                            ? baseOutcome
                            : baseOutcome === 'self'
                            ? 'opponent'
                            : baseOutcome === 'opponent'
                            ? 'self'
                            : 'draw',
                    tokenChange: actor === 'spieler' ? finalTokenDiff : -finalTokenDiff,
                };
                simFusionEngine.learn(decision, actorOutcome);
            }

            allData.push({
                spieler_karte: `${playerCard.element} ${playerCard.wert}`,
                gegner_karte: `${aiCard.element} ${aiCard.wert}`,
                spieler_token_vorher: prePlayerTokens,
                gegner_token_vorher: preAiTokens,
                spieler_token: playerTokensAfter,
                gegner_token: aiTokensAfter,
                wetter: weather,
                spieler_held: playerHero,
                gegner_held: aiHero,
                gewinner: winner,
                fusionDecisions: roundFusionDecisions,
            });

            history.push({
                round: history.length + 1,
                playerCard,
                aiCard,
                weather,
                winner,
                playerTokens: playerTokensAfter,
                aiTokens: aiTokensAfter,
            });

            ensureHandSize(playerHand, talon, 'spieler');
            ensureHandSize(aiHand, talon, 'gegner');

            roundsPlayed += 1;
            ensureSimulationNotAborted(signal);
        }

        onProgress?.(i + 1, numGames);
        await yieldToBrowser(i + 1, chunkSize, delay, signal);
    }

    if (numGames === 0) {
        onProgress?.(0, 0);
    }

    await augmentWithFocusRounds(numGames, allData, {
        chunkSize,
        yieldDelayMs: delay,
        signal,
    });

    return allData;
}

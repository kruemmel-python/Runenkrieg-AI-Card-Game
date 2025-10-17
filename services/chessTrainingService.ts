import {
    ChessAiInsight,
    ChessColor,
    ChessMove,
    ChessMoveSuggestion,
    ChessOutcome,
    ChessSimulationResult,
    ChessTrainingSummary,
    TrainedChessModel,
    ChessResonanceLink,
    ChessLearningBalanceItem,
    ChessDominantColor,
    TrainingRunOptions,
} from '../types';
import { SimpleChess, getPieceValue } from './chessEngine';
import { computeChessMoveStatsGpu } from './gpuAcceleration';

interface ChessSimulationOptions {
    maxPlies?: number;
    randomness?: number;
}

interface PositionMoveStats {
    total: number;
    wins: number;
    losses: number;
    draws: number;
}

interface PositionStats {
    total: number;
    wins: number;
    losses: number;
    draws: number;
    moves: Map<string, PositionMoveStats>;
}

const PIECE_SAFETY_BONUS: Record<string, number> = {
    center: 0.4,
    develop: 0.2,
    kingSafety: 0.6,
};

const MAX_PLIES_DEFAULT = 200;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const calculateEntropy = (distribution: number[]): number =>
    distribution.reduce((entropy, probability) => {
        if (probability <= 0) {
            return entropy;
        }
        return entropy - probability * Math.log2(probability);
    }, 0);

const switchFenTurn = (fen: string, color: ChessColor): string => {
    const parts = fen.split(' ');
    if (parts.length < 2) {
        return fen;
    }
    parts[1] = color === 'white' ? 'w' : 'b';
    return parts.join(' ');
};

const computeMobility = (fen: string, color: ChessColor): number => {
    const normalizedFen = switchFenTurn(fen, color);
    const game = SimpleChess.fromFen(normalizedFen);
    return game.generateLegalMoves().length;
};

const parseSquare = (square: string): { row: number; col: number } => {
    const file = square[0];
    const rank = square[1];
    const col = file ? file.charCodeAt(0) - 97 : 0;
    const row = rank ? 8 - parseInt(rank, 10) : 0;
    return { row, col };
};

const createDefaultResonanceMapping = (): ChessResonanceLink[] => [
    {
        rune: 'Überladung',
        chessPattern: 'Opferkombinationen',
        intensity: 0,
        dominantColor: 'balanced',
        commentary: 'Noch keine Simulationen für Opferkombinationen analysiert.',
    },
    {
        rune: 'Resonanz',
        chessPattern: 'Figurensynergien',
        intensity: 0,
        dominantColor: 'balanced',
        commentary: 'Noch keine Daten zu koordiniertem Figurenspiel.',
    },
    {
        rune: 'Wetterbindung',
        chessPattern: 'Brettstruktur (offen/geschlossen)',
        intensity: 0,
        dominantColor: 'balanced',
        commentary: 'Noch keine strukturellen Muster erkannt.',
    },
];

const createDefaultLearningBalance = (): ChessLearningBalanceItem[] => [
    {
        runeMechanic: 'Überladung',
        chessConcept: 'Opferkombinationen',
        whiteScore: 0,
        blackScore: 0,
        balance: 0,
        description: 'Noch keine Opfermotive in den Simulationen.',
    },
    {
        runeMechanic: 'Resonanz',
        chessConcept: 'Figurensynergien',
        whiteScore: 0,
        blackScore: 0,
        balance: 0,
        description: 'Noch keine koordinierten Angriffe beobachtet.',
    },
    {
        runeMechanic: 'Wetterbindung',
        chessConcept: 'Brettstruktur (offen/geschlossen)',
        whiteScore: 0,
        blackScore: 0,
        balance: 0,
        description: 'Noch keine strukturellen Umformungen erkannt.',
    },
];

const dominantColorFromContributions = (
    white: number,
    black: number,
    epsilon = 0.01
): ChessDominantColor => {
    const total = white + black;
    if (total <= epsilon) {
        return 'balanced';
    }
    if (white > black + epsilon) {
        return 'white';
    }
    if (black > white + epsilon) {
        return 'black';
    }
    return 'balanced';
};

const describeBalance = (
    balance: number,
    runeMechanic: string,
    chessConcept: string,
    total: number
): string => {
    if (total <= 0.001) {
        return `Noch keine ${chessConcept}-Muster sichtbar.`;
    }
    const emphasis = Math.abs(balance);
    if (emphasis < 0.15) {
        return `${runeMechanic} ↔ ${chessConcept} verläuft ausgeglichen.`;
    }
    if (balance > 0) {
        return `Weiß treibt ${chessConcept} (${runeMechanic}) stärker voran.`;
    }
    return `Schwarz bestimmt ${chessConcept} (${runeMechanic}) dominanter.`;
};

const buildOpeningSequence = (uciMoves: string[]): string => {
    const limit = Math.min(4, uciMoves.length);
    return uciMoves.slice(0, limit).join(' ');
};

const evaluateMoveHeuristic = (
    game: SimpleChess,
    move: ChessMove,
    randomness: number
): number => {
    let score = Math.random() * randomness;

    if (move.isCapture && move.captured) {
        score += getPieceValue(move.captured) + 0.5;
    }

    if (move.isPromotion) {
        score += 8;
    }

    if (move.isCastleKingSide || move.isCastleQueenSide) {
        score += PIECE_SAFETY_BONUS.kingSafety;
    }

    const centerSquares = new Set(['d4', 'd5', 'e4', 'e5']);
    if (centerSquares.has(move.to)) {
        score += PIECE_SAFETY_BONUS.center;
    }

    // Encourage development of knights and bishops
    if ((move.piece === 'n' || move.piece === 'b') && move.from[1] === (move.color === 'white' ? '1' : '8')) {
        score += PIECE_SAFETY_BONUS.develop;
    }

    // Evaluate resulting position
    game.makeMove(move);
    const opponentColor: ChessColor = move.color === 'white' ? 'black' : 'white';
    const opponentInCheck = game.isInCheck(opponentColor);
    if (opponentInCheck) {
        score += 0.7;
    }
    const material = game.evaluateMaterialBalance(move.color);
    score += material * 0.05;
    game.undo();

    return score;
};

const chooseSimulationMove = (
    game: SimpleChess,
    randomness: number
): ChessMove => {
    const legalMoves = game.generateLegalMoves();
    if (legalMoves.length === 0) {
        throw new Error('Keine legalen Züge verfügbar');
    }

    let bestMove = legalMoves[0];
    let bestScore = -Infinity;

    for (const move of legalMoves) {
        const score = evaluateMoveHeuristic(game, move, randomness);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
};

const yieldToEventLoop = () =>
    new Promise<void>((resolve) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });

export const simulateChessGames = async (
    count: number,
    options: ChessSimulationOptions = {},
    onProgress?: (completed: number, total: number) => void
): Promise<ChessSimulationResult[]> => {
    const results: ChessSimulationResult[] = [];
    const maxPlies = options.maxPlies ?? MAX_PLIES_DEFAULT;
    const randomness = options.randomness ?? 1;
    const yieldInterval = Math.max(1, Math.floor(200 / Math.max(1, maxPlies / 10)));

    for (let i = 0; i < count; i++) {
        const game = new SimpleChess();
        const moveRecords: { fen: string; move: string; color: ChessColor }[] = [];
        const uciSequence: string[] = [];
        let plies = 0;

        while (!game.isGameOver() && plies < maxPlies) {
            const fenBefore = game.getFen();
            const move = chooseSimulationMove(game, randomness);
            const uci = game.toUci(move);
            moveRecords.push({ fen: fenBefore, move: uci, color: move.color });
            uciSequence.push(uci);
            game.makeMove(move);
            plies += 1;
        }

        const { outcome, reason } = game.getResult();
        const winner = outcome ?? 'draw';
        const finalReason = reason ?? (plies >= maxPlies ? 'maxPlies' : 'stalemate');

        results.push({
            moves: moveRecords,
            winner,
            reason: finalReason as ChessSimulationResult['reason'],
            plies,
            openingSequence: buildOpeningSequence(uciSequence),
        });

        const completed = i + 1;
        if (onProgress) {
            onProgress(completed, count);
        }
        if (completed % yieldInterval === 0 && completed < count) {
            await yieldToEventLoop();
        }
    }

    return results;
};

export const summarizeChessSimulations = (
    simulations: ChessSimulationResult[]
): ChessTrainingSummary => {
    if (simulations.length === 0) {
        return {
            totalGames: 0,
            whiteWins: 0,
            blackWins: 0,
            draws: 0,
            averagePlies: 0,
            decisiveRate: 0,
            topOpenings: [],
            entropyWhite: 0,
            entropyBlack: 0,
            entropyDelta: 0,
            resonanceMapping: createDefaultResonanceMapping(),
            learningBalance: createDefaultLearningBalance(),
        };
    }

    let whiteWins = 0;
    let blackWins = 0;
    let draws = 0;
    let totalPlies = 0;
    const openingCounter = new Map<string, { count: number; whiteWins: number; blackWins: number }>();

    const colorAggregates: Record<ChessColor, {
        moves: number;
        sacrifices: number;
        synergy: number;
        structure: number;
        aggression: number;
    }> = {
        white: { moves: 0, sacrifices: 0, synergy: 0, structure: 0, aggression: 0 },
        black: { moves: 0, sacrifices: 0, synergy: 0, structure: 0, aggression: 0 },
    };

    for (const game of simulations) {
        totalPlies += game.plies;
        if (game.winner === 'white') whiteWins += 1;
        if (game.winner === 'black') blackWins += 1;
        if (game.winner === 'draw') draws += 1;

        if (!openingCounter.has(game.openingSequence)) {
            openingCounter.set(game.openingSequence, { count: 0, whiteWins: 0, blackWins: 0 });
        }
        const entry = openingCounter.get(game.openingSequence)!;
        entry.count += 1;
        if (game.winner === 'white') entry.whiteWins += 1;
        if (game.winner === 'black') entry.blackWins += 1;

        for (const moveRecord of game.moves) {
            const mover = moveRecord.color;
            const opponent: ChessColor = mover === 'white' ? 'black' : 'white';
            const aggregate = colorAggregates[mover];
            aggregate.moves += 1;

            const baseGame = SimpleChess.fromFen(moveRecord.fen);
            const beforeMaterial = baseGame.evaluateMaterialBalance(mover);
            const opponentMaterialBefore = baseGame.evaluateMaterialBalance(opponent);
            const opponentMobilityBefore = computeMobility(moveRecord.fen, opponent);

            const boardBefore = baseGame.getBoard();
            const fromSquare = moveRecord.move.slice(0, 2);
            const { row: fromRow, col: fromCol } = parseSquare(fromSquare);
            const pieceBefore = boardBefore?.[fromRow]?.[fromCol] ?? null;
            const isPawnMove = pieceBefore?.type === 'p';

            const afterGame = SimpleChess.fromFen(moveRecord.fen);
            const moveApplied = afterGame.makeMove(moveRecord.move);
            if (!moveApplied) {
                continue;
            }

            const afterMaterial = afterGame.evaluateMaterialBalance(mover);
            const opponentMaterialAfter = afterGame.evaluateMaterialBalance(opponent);
            const opponentMobilityAfter = afterGame.generateLegalMoves().length;
            const gaveCheck = afterGame.isInCheck(opponent);

            const materialSwing = afterMaterial - beforeMaterial;
            const opponentMaterialSwing = opponentMaterialAfter - opponentMaterialBefore;
            const isCapture = opponentMaterialSwing < -0.1;
            const synergyGain = Math.max(0, opponentMobilityBefore - opponentMobilityAfter);

            let structureGain = 0;
            if (isPawnMove && !isCapture) {
                structureGain += 1 + (synergyGain > 0 ? 0.4 : 0);
            } else if (!isPawnMove && !isCapture && synergyGain <= 0 && Math.abs(materialSwing) < 0.5) {
                structureGain += 0.2;
            }

            const sacrifice = materialSwing <= -3 && (gaveCheck || synergyGain >= 2);
            if (sacrifice) {
                aggregate.sacrifices += 1;
            }

            aggregate.synergy += synergyGain;
            aggregate.structure += structureGain;
            aggregate.aggression += (isCapture ? 1 : 0) + (gaveCheck ? 0.7 : 0);
        }
    }

    const topOpenings = Array.from(openingCounter.entries())
        .filter(([sequence]) => sequence.length > 0)
        .map(([sequence, data]) => {
            const drawsForOpening = data.count - data.whiteWins - data.blackWins;
            const winRate = data.count > 0 ? (data.whiteWins + drawsForOpening * 0.5) / data.count : 0;
            return {
                sequence,
                count: data.count,
                winRate,
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const totalGames = simulations.length;
    const decisiveRate = totalGames > 0 ? (whiteWins + blackWins) / totalGames : 0;

    const whiteWinRate = totalGames > 0 ? whiteWins / totalGames : 0;
    const drawRate = totalGames > 0 ? draws / totalGames : 0;
    const blackWinRate = totalGames > 0 ? blackWins / totalGames : 0;

    const entropyWhite = calculateEntropy([whiteWinRate, drawRate, blackWinRate]);
    const entropyBlack = calculateEntropy([blackWinRate, drawRate, whiteWinRate]);
    const entropyDelta = entropyWhite - entropyBlack;

    const whiteMoves = colorAggregates.white.moves;
    const blackMoves = colorAggregates.black.moves;

    const normalize = (value: number, moves: number): number => (moves > 0 ? value / moves : 0);

    const whiteSacrificeRate = normalize(colorAggregates.white.sacrifices, whiteMoves);
    const blackSacrificeRate = normalize(colorAggregates.black.sacrifices, blackMoves);
    const whiteSynergyRate = normalize(colorAggregates.white.synergy, whiteMoves);
    const blackSynergyRate = normalize(colorAggregates.black.synergy, blackMoves);
    const whiteStructureRate = normalize(colorAggregates.white.structure, whiteMoves);
    const blackStructureRate = normalize(colorAggregates.black.structure, blackMoves);

    const averageSacrifice = (whiteSacrificeRate + blackSacrificeRate) / 2;
    const averageSynergy = (whiteSynergyRate + blackSynergyRate) / 2;
    const averageStructure = (whiteStructureRate + blackStructureRate) / 2;

    const sacrificeDominant = dominantColorFromContributions(whiteSacrificeRate, blackSacrificeRate);
    const synergyDominant = dominantColorFromContributions(whiteSynergyRate, blackSynergyRate);
    const structureDominant = dominantColorFromContributions(whiteStructureRate, blackStructureRate);

    const resonanceMapping: ChessResonanceLink[] = [
        {
            rune: 'Überladung',
            chessPattern: 'Opferkombinationen',
            intensity: clamp01(averageSacrifice / 0.12),
            dominantColor: sacrificeDominant,
            commentary:
                sacrificeDominant === 'balanced'
                    ? 'Beide Seiten opfern mit ähnlicher Frequenz, Risiko wird symmetrisch verteilt.'
                    : sacrificeDominant === 'white'
                        ? 'Weiß initiiert Opferkombinationen häufiger und forciert Überladung.'
                        : 'Schwarz nutzt Opferkombinationen proaktiver und erzwingt Überladung.',
        },
        {
            rune: 'Resonanz',
            chessPattern: 'Figurensynergien',
            intensity: clamp01(averageSynergy / 3.5),
            dominantColor: synergyDominant,
            commentary:
                synergyDominant === 'balanced'
                    ? 'Figurenverbünde greifen ausgewogen an, die Resonanz bleibt im Gleichgewicht.'
                    : synergyDominant === 'white'
                        ? 'Weiß bündelt Figuren häufiger zu Druckwellen.'
                        : 'Schwarz koordiniert Figuren enger und erzeugt Resonanzdruck.',
        },
        {
            rune: 'Wetterbindung',
            chessPattern: 'Brettstruktur (offen/geschlossen)',
            intensity: clamp01(averageStructure / 1.6),
            dominantColor: structureDominant,
            commentary:
                structureDominant === 'balanced'
                    ? 'Beide Seiten formen die Brettstruktur gleichermaßen.'
                    : structureDominant === 'white'
                        ? 'Weiß bestimmt das Strukturelle Klima und bindet das Brett häufiger.'
                        : 'Schwarz verriegelt das Brett öfter und kontrolliert die Struktur.',
        },
    ];

    const sacrificeBalance =
        whiteSacrificeRate + blackSacrificeRate > 0
            ? (whiteSacrificeRate - blackSacrificeRate) / (whiteSacrificeRate + blackSacrificeRate)
            : 0;
    const synergyBalance =
        whiteSynergyRate + blackSynergyRate > 0
            ? (whiteSynergyRate - blackSynergyRate) / (whiteSynergyRate + blackSynergyRate)
            : 0;
    const structureBalance =
        whiteStructureRate + blackStructureRate > 0
            ? (whiteStructureRate - blackStructureRate) / (whiteStructureRate + blackStructureRate)
            : 0;

    const learningBalance: ChessLearningBalanceItem[] = [
        {
            runeMechanic: 'Überladung',
            chessConcept: 'Opferkombinationen',
            whiteScore: whiteSacrificeRate,
            blackScore: blackSacrificeRate,
            balance: sacrificeBalance,
            description: describeBalance(
                sacrificeBalance,
                'Überladung',
                'Opferkombinationen',
                whiteSacrificeRate + blackSacrificeRate
            ),
        },
        {
            runeMechanic: 'Resonanz',
            chessConcept: 'Figurensynergien',
            whiteScore: whiteSynergyRate,
            blackScore: blackSynergyRate,
            balance: synergyBalance,
            description: describeBalance(
                synergyBalance,
                'Resonanz',
                'Figurensynergien',
                whiteSynergyRate + blackSynergyRate
            ),
        },
        {
            runeMechanic: 'Wetterbindung',
            chessConcept: 'Brettstruktur (offen/geschlossen)',
            whiteScore: whiteStructureRate,
            blackScore: blackStructureRate,
            balance: structureBalance,
            description: describeBalance(
                structureBalance,
                'Wetterbindung',
                'Brettstruktur (offen/geschlossen)',
                whiteStructureRate + blackStructureRate
            ),
        },
    ];

    return {
        totalGames,
        whiteWins,
        blackWins,
        draws,
        averagePlies: totalPlies / totalGames,
        decisiveRate,
        topOpenings,
        entropyWhite,
        entropyBlack,
        entropyDelta,
        resonanceMapping,
        learningBalance,
    };
};

const fenKey = (fen: string, strict: boolean): string => {
    const parts = fen.split(' ');
    if (strict) {
        return parts.slice(0, 4).join(' ');
    }
    return parts.slice(0, 2).join(' ');
};

const expectedScore = (wins: number, losses: number, draws: number): number => {
    const total = wins + losses + draws;
    if (total === 0) {
        return 0.5;
    }
    return (wins + draws * 0.5) / total;
};

const confidenceScore = (samples: number): number => {
    if (samples === 0) return 0;
    return Math.min(1, Math.log10(samples + 1) / 2);
};

const CHESS_INITIALIZATION_PROGRESS_SHARE = 0.05;
const MIN_GAME_PROGRESS_STEPS = 40;
const MIN_POSITION_PROGRESS_STEPS = 30;

const computeYieldInterval = (total: number, desiredSteps: number) =>
    Math.max(1, Math.floor(Math.max(1, total) / Math.max(1, desiredSteps)));

const yieldDuringTraining = async (iteration: number, interval: number) => {
    if (interval > 0 && iteration % interval === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
};

export const trainChessModel = async (
    simulations: ChessSimulationResult[],
    options: TrainingRunOptions = {}
): Promise<TrainedChessModel> => {
    const { onProgress, preferGpu = false } = options;
    const positions = new Map<string, PositionStats>();

    const increment = (
        key: string,
        move: string,
        outcome: ChessOutcome,
        mover: ChessColor
    ) => {
        if (!positions.has(key)) {
            positions.set(key, {
                total: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                moves: new Map<string, PositionMoveStats>(),
            });
        }
        const stats = positions.get(key)!;
        stats.total += 1;
        const resultForMover = outcome === 'draw' ? 'draws' : outcome === mover ? 'wins' : 'losses';
        stats[resultForMover] += 1;

        if (!stats.moves.has(move)) {
            stats.moves.set(move, { total: 0, wins: 0, losses: 0, draws: 0 });
        }
        const moveStats = stats.moves.get(move)!;
        moveStats.total += 1;
        if (outcome === 'draw') moveStats.draws += 1;
        else if (outcome === mover) moveStats.wins += 1;
        else moveStats.losses += 1;
    };

    onProgress?.({
        phase: 'initializing',
        progress: CHESS_INITIALIZATION_PROGRESS_SHARE,
        message: 'Bereite Schach-Trainingsdaten vor.',
    });

    const totalGames = simulations.length;
    const safeTotalGames = Math.max(1, totalGames);
    const gameYieldInterval = computeYieldInterval(totalGames, MIN_GAME_PROGRESS_STEPS);
    const aggregationShare = totalGames > 0 ? 0.45 : 0;
    const analysisShare = Math.max(0, 1 - CHESS_INITIALIZATION_PROGRESS_SHARE - aggregationShare);

    for (let gameIndex = 0; gameIndex < simulations.length; gameIndex++) {
        const game = simulations[gameIndex];
        for (const moveRecord of game.moves) {
            const strictKey = fenKey(moveRecord.fen, true);
            const relaxedKey = fenKey(moveRecord.fen, false);
            increment(strictKey, moveRecord.move, game.winner, moveRecord.color);
            increment(relaxedKey, moveRecord.move, game.winner, moveRecord.color);
        }

        if ((gameIndex + 1) % gameYieldInterval === 0 || gameIndex === simulations.length - 1) {
            const ratio = (gameIndex + 1) / safeTotalGames;
            onProgress?.({
                phase: 'aggregating',
                progress: CHESS_INITIALIZATION_PROGRESS_SHARE + aggregationShare * ratio,
                message: `Verarbeite Schachpartie ${gameIndex + 1} von ${safeTotalGames}`,
            });
            await yieldDuringTraining(gameIndex + 1, gameYieldInterval);
        }
    }

    if (totalGames === 0) {
        onProgress?.({
            phase: 'aggregating',
            progress: CHESS_INITIALIZATION_PROGRESS_SHARE,
            message: 'Keine Schachsimulationen – nutze vorhandene Priors.',
        });
    } else {
        onProgress?.({
            phase: 'aggregating',
            progress: CHESS_INITIALIZATION_PROGRESS_SHARE + aggregationShare,
            message: 'Schachsimulationen verarbeitet. Analysiere Positionen...',
        });
    }

    const summary = summarizeChessSimulations(simulations);

    const insights: ChessAiInsight[] = [];
    const positionEntries = Array.from(positions.entries());
    const safePositionTotal = Math.max(1, positionEntries.length);
    const positionYieldInterval = computeYieldInterval(positionEntries.length, MIN_POSITION_PROGRESS_STEPS);
    let gpuUtilized = false;
    let gpuAvailableForPositions = preferGpu;

    for (let positionIndex = 0; positionIndex < positionEntries.length; positionIndex++) {
        const [key, stats] = positionEntries[positionIndex];
        const moveEntries = Array.from(stats.moves.entries());
        if (moveEntries.length === 0) {
            continue;
        }

        const winsArray = new Float32Array(moveEntries.length);
        const lossesArray = new Float32Array(moveEntries.length);
        const drawsArray = new Float32Array(moveEntries.length);
        for (let idx = 0; idx < moveEntries.length; idx++) {
            const moveStats = moveEntries[idx][1];
            winsArray[idx] = moveStats.wins;
            lossesArray[idx] = moveStats.losses;
            drawsArray[idx] = moveStats.draws;
        }

        let gpuStats: Float32Array | null = null;
        if (gpuAvailableForPositions && moveEntries.length >= 4) {
            try {
                gpuStats = await computeChessMoveStatsGpu(winsArray, lossesArray, drawsArray);
                if (gpuStats) {
                    gpuUtilized = true;
                } else {
                    gpuAvailableForPositions = false;
                }
            } catch (error) {
                console.warn('GPU-gestützte Berechnung der Schachzüge fehlgeschlagen, nutze CPU.', error);
                gpuAvailableForPositions = false;
                gpuStats = null;
            }
        }

        for (let moveIndex = 0; moveIndex < moveEntries.length; moveIndex++) {
            const [move, moveStats] = moveEntries[moveIndex];
            if (moveStats.total < 5) {
                continue;
            }

            let expected: number;
            let confidence: number;
            if (gpuStats && gpuStats.length >= (moveIndex + 1) * 2) {
                const baseIndex = moveIndex * 2;
                expected = gpuStats[baseIndex];
                confidence = gpuStats[baseIndex + 1];
            } else {
                expected = expectedScore(moveStats.wins, moveStats.losses, moveStats.draws);
                confidence = confidenceScore(moveStats.total);
            }

            insights.push({
                fen: key,
                recommendedMove: move,
                confidence,
                expectedScore: expected,
                sampleSize: moveStats.total,
            });
        }

        if ((positionIndex + 1) % positionYieldInterval === 0 || positionIndex === positionEntries.length - 1) {
            const ratio = (positionIndex + 1) / safePositionTotal;
            const progressValue =
                CHESS_INITIALIZATION_PROGRESS_SHARE + aggregationShare + analysisShare * ratio;
            const messageBase = preferGpu
                ? gpuUtilized
                    ? 'Bewerte Positionen (GPU aktiv)'
                    : 'Bewerte Positionen (GPU bevorzugt)'
                : 'Bewerte Positionen';
            onProgress?.({
                phase: 'analyzing',
                progress: Math.min(0.999, progressValue),
                message: `${messageBase} – ${positionIndex + 1}/${safePositionTotal}`,
            });
            await yieldDuringTraining(positionIndex + 1, positionYieldInterval);
        }
    }

    insights.sort((a, b) => b.expectedScore - a.expectedScore || b.confidence - a.confidence);

    const chooseMove = (
        fen: string,
        legalMoves: ChessMove[],
        color: ChessColor
    ): ChessMoveSuggestion => {
        const keys = [fenKey(fen, true), fenKey(fen, false)];
        let bestSuggestion: ChessMoveSuggestion | null = null;

        for (const key of keys) {
            const stats = positions.get(key);
            if (!stats) continue;
            for (const legal of legalMoves) {
                const moveKey = legal.from + legal.to + (legal.promotion ?? '');
                const moveStats = stats.moves.get(moveKey);
                if (!moveStats) continue;
                const expected = expectedScore(moveStats.wins, moveStats.losses, moveStats.draws);
                const confidence = confidenceScore(moveStats.total);
                const rationale = `Erwarteter Score ${expected.toFixed(2)} bei ${moveStats.total} Partien.`;
                const suggestion: ChessMoveSuggestion = {
                    move: legal,
                    expectedScore: expected,
                    confidence,
                    sampleSize: moveStats.total,
                    rationale,
                };
                if (!bestSuggestion || expected > bestSuggestion.expectedScore || (
                    Math.abs(expected - bestSuggestion.expectedScore) < 0.01 && confidence > bestSuggestion.confidence
                )) {
                    bestSuggestion = suggestion;
                }
            }
        }

        if (bestSuggestion) {
            return bestSuggestion;
        }

        // Fallback: choose heuristic move when no data
        const tempGame = SimpleChess.fromFen(fen);
        const fallbackMoves = legalMoves.map((move) => ({
            move,
            score: evaluateMoveHeuristic(tempGame, move, 1),
        }));
        fallbackMoves.sort((a, b) => b.score - a.score);
        const best = fallbackMoves[0];
        return {
            move: best.move,
            expectedScore: 0.5,
            confidence: 0,
            sampleSize: 0,
            rationale: 'Heuristischer Zug mangels Trainingsdaten',
        };
    };

    const finalMessage = preferGpu
        ? gpuUtilized
            ? 'Schachtraining abgeschlossen. GPU-Beschleunigung aktiv.'
            : 'Schachtraining abgeschlossen. GPU nicht verfügbar – CPU genutzt.'
        : 'Schachtraining abgeschlossen.';
    onProgress?.({ phase: 'finalizing', progress: 1, message: finalMessage });

    return {
        chooseMove,
        summary,
        insights: insights.slice(0, 25),
    };
};

import {
    ChessAiInsight,
    ChessColor,
    ChessMove,
    ChessMoveSuggestion,
    ChessOutcome,
    ChessSimulationResult,
    ChessTrainingSummary,
    TrainedChessModel,
} from '../types';
import { SimpleChess, getPieceValue } from './chessEngine';

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

export const simulateChessGames = (
    count: number,
    options: ChessSimulationOptions = {}
): ChessSimulationResult[] => {
    const results: ChessSimulationResult[] = [];
    const maxPlies = options.maxPlies ?? MAX_PLIES_DEFAULT;
    const randomness = options.randomness ?? 1;

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
        };
    }

    let whiteWins = 0;
    let blackWins = 0;
    let draws = 0;
    let totalPlies = 0;
    const openingCounter = new Map<string, { count: number; whiteWins: number; blackWins: number }>();

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

    return {
        totalGames,
        whiteWins,
        blackWins,
        draws,
        averagePlies: totalPlies / totalGames,
        decisiveRate,
        topOpenings,
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

export const trainChessModel = (
    simulations: ChessSimulationResult[]
): TrainedChessModel => {
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

    for (const game of simulations) {
        for (const moveRecord of game.moves) {
            const strictKey = fenKey(moveRecord.fen, true);
            const relaxedKey = fenKey(moveRecord.fen, false);
            increment(strictKey, moveRecord.move, game.winner, moveRecord.color);
            increment(relaxedKey, moveRecord.move, game.winner, moveRecord.color);
        }
    }

    const summary = summarizeChessSimulations(simulations);

    const insights: ChessAiInsight[] = [];
    positions.forEach((stats, key) => {
        stats.moves.forEach((moveStats, move) => {
            if (moveStats.total < 5) {
                return;
            }
            const expected = expectedScore(moveStats.wins, moveStats.losses, moveStats.draws);
            const confidence = confidenceScore(moveStats.total);
            insights.push({
                fen: key,
                recommendedMove: move,
                confidence,
                expectedScore: expected,
                sampleSize: moveStats.total,
            });
        });
    });

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

    return {
        chooseMove,
        summary,
        insights: insights.slice(0, 25),
    };
};

import { SimpleChess } from './chessEngine';
import { ChessColor, ChessMoveSuggestion, TrainedChessModel } from '../types';

let trainedModel: TrainedChessModel | null = null;

export const setTrainedChessModel = (model: TrainedChessModel) => {
    trainedModel = model;
};

export const isChessAiTrained = (): boolean => trainedModel !== null;

const chooseHeuristicMove = (game: SimpleChess): ChessMoveSuggestion => {
    const legalMoves = game.generateLegalMoves();
    const selected = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    return {
        move: selected,
        confidence: 0,
        expectedScore: 0.5,
        sampleSize: 0,
        rationale: 'Zufallszug mangels Trainingsdaten',
    };
};

export const chooseChessMove = (fen: string, color: ChessColor): ChessMoveSuggestion => {
    const game = SimpleChess.fromFen(fen);
    if (game.getTurn() !== color) {
        throw new Error('Falsche Zugfarbe für die FEN übergeben.');
    }
    const legalMoves = game.generateLegalMoves();
    if (legalMoves.length === 0) {
        return {
            move: {
                from: 'a1',
                to: 'a1',
                piece: 'k',
                color,
                isCapture: false,
                isPromotion: false,
                isEnPassant: false,
                isCastleKingSide: false,
                isCastleQueenSide: false,
            },
            confidence: 0,
            expectedScore: 0,
            sampleSize: 0,
            rationale: 'Keine Züge verfügbar',
        };
    }

    if (!trainedModel) {
        return chooseHeuristicMove(game);
    }

    const suggestion = trainedModel.chooseMove(fen, legalMoves, color);
    return suggestion;
};

export const getChessInsights = () => trainedModel?.insights ?? [];

export const getChessSummary = () => trainedModel?.summary ?? null;

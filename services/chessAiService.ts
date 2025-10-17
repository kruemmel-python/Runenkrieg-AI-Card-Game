import { SimpleChess } from './chessEngine';
import { ChessColor, ChessMoveSuggestion, TrainedChessModel, SerializedChessModel } from '../types';
import { hydrateChessModel } from './chessTrainingService';
import { loadStoredChessModel, storeChessModel } from './modelPersistence';

let trainedModel: TrainedChessModel | null = null;

const restoreTrainedChessModel = () => {
    if (trainedModel) {
        return;
    }

    try {
        const stored = loadStoredChessModel();
        if (stored) {
            trainedModel = hydrateChessModel(stored);
        }
    } catch (error) {
        console.warn('Gespeichertes Schach-Modell konnte nicht geladen werden:', error);
    }
};

if (typeof window !== 'undefined') {
    restoreTrainedChessModel();
}

export const setTrainedChessModel = (model: TrainedChessModel, options: { skipDownload?: boolean } = {}) => {
    trainedModel = model;
    try {
        storeChessModel(model.serialize(), { triggerDownload: options.skipDownload !== true });
    } catch (error) {
        console.warn('Schach-Modell konnte nicht gespeichert werden:', error);
    }
};

export const isChessAiTrained = (): boolean => trainedModel !== null;

export const getTrainedChessModel = (): TrainedChessModel | null => trainedModel;

export const importChessModelFromFile = async (file: File): Promise<TrainedChessModel> => {
    const content = await file.text();
    let parsed: SerializedChessModel;
    try {
        parsed = JSON.parse(content) as SerializedChessModel;
    } catch (error) {
        throw new Error('Die ausgewählte Datei enthält kein gültiges Schach-Modell.');
    }

    const model = hydrateChessModel(parsed);
    setTrainedChessModel(model, { skipDownload: true });
    return model;
};

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

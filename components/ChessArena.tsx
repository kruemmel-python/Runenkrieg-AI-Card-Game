import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChessColor, ChessMove, ChessMoveSuggestion, ChessPiece } from '../types';
import { SimpleChess, PIECE_SYMBOLS } from '../services/chessEngine';
import { chooseChessMove, isChessAiTrained } from '../services/chessAiService';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

type View = 'card' | 'training' | 'chess' | 'shooter';

const squareName = (row: number, col: number) => `${FILES[col]}${8 - row}`;

const squareToCoords = (square: string): { row: number; col: number } => {
    const file = FILES.indexOf(square[0]);
    const rank = parseInt(square[1], 10);
    return { row: 8 - rank, col: file };
};

const formatWinner = (outcome: ChessColor | 'draw' | null) => {
    if (!outcome) {
        return 'Unentschieden';
    }
    if (outcome === 'draw') {
        return 'Unentschieden';
    }
    return outcome === 'white' ? 'Weiß' : 'Schwarz';
};

const ChessArena: React.FC<{ onSwitchView: (view: View) => void }> = ({ onSwitchView }) => {
    const [playerColor, setPlayerColor] = useState<ChessColor>('white');
    const [aiStatus, setAiStatus] = useState<string>(
        isChessAiTrained() ? 'Trainierte Schach-KI aktiv.' : 'KI nutzt heuristische Heuristiken.'
    );
    const [statusMessage, setStatusMessage] = useState<string>('Wähle eine Farbe und starte die Partie.');
    const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
    const [lastAiExplanation, setLastAiExplanation] = useState<string | null>(null);
    const [gameOverInfo, setGameOverInfo] = useState<{ winner: string; reason: string } | null>(null);
    const [turn, setTurn] = useState<ChessColor>('white');
    const [fen, setFen] = useState<string>('');
    const [legalMoves, setLegalMoves] = useState<ChessMove[]>([]);
    const [boardState, setBoardState] = useState<(ChessPiece | null)[][]>(new SimpleChess().getBoard());
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
    const [highlightSquares, setHighlightSquares] = useState<{ from: string | null; to: string | null }>({
        from: null,
        to: null,
    });
    const [moveLog, setMoveLog] = useState<string[]>([]);

    const gameRef = useRef<SimpleChess>(new SimpleChess());

    const aiColor: ChessColor = playerColor === 'white' ? 'black' : 'white';

    const syncState = useCallback(() => {
        const game = gameRef.current;
        setBoardState(game.getBoard());
        setFen(game.getFen());
        const currentTurn = game.getTurn();
        setTurn(currentTurn);
        setLegalMoves(game.generateLegalMoves());
        setAiStatus(isChessAiTrained() ? 'Trainierte Schach-KI aktiv.' : 'KI nutzt heuristische Heuristiken.');

        if (game.isGameOver()) {
            const { outcome, reason } = game.getResult();
            const winnerLabel = formatWinner(outcome ?? 'draw');
            setGameOverInfo({ winner: winnerLabel, reason: reason ?? 'Unbekannt' });
            setStatusMessage(`Partie beendet: ${winnerLabel} (${reason ?? 'ohne Grundangabe'})`);
        } else if (currentTurn === playerColor) {
            setStatusMessage('Du bist am Zug.');
            setGameOverInfo(null);
        } else {
            setStatusMessage('KI ist am Zug.');
            setGameOverInfo(null);
        }
    }, [playerColor]);

    const startNewGame = useCallback(() => {
        const newGame = new SimpleChess();
        gameRef.current = newGame;
        setMoveLog([]);
        setSelectedSquare(null);
        setHighlightSquares({ from: null, to: null });
        setLastAiExplanation(null);
        setIsAiThinking(false);
        setStatusMessage(playerColor === 'white' ? 'Du beginnst mit Weiß.' : 'Die KI beginnt als Weiß.');
        setGameOverInfo(null);
        syncState();
    }, [playerColor, syncState]);

    useEffect(() => {
        startNewGame();
    }, [startNewGame]);

    const targetSquares = useMemo(() => {
        if (!selectedSquare) {
            return new Set<string>();
        }
        const targets = legalMoves
            .filter((move) => move.from === selectedSquare)
            .map((move) => move.to);
        return new Set(targets);
    }, [selectedSquare, legalMoves]);

    const pushMoveLog = useCallback(
        (color: ChessColor, move: ChessMove) => {
            const game = gameRef.current;
            const notation = game.toUci(move);
            setMoveLog((prev) => [...prev, `${color === 'white' ? 'Weiß' : 'Schwarz'}: ${notation}`]);
        },
        []
    );

    const handlePlayerMove = useCallback(
        (move: ChessMove) => {
            if (isAiThinking || turn !== playerColor || gameRef.current.isGameOver()) {
                return;
            }
            const game = gameRef.current;
            const success = game.makeMove(move);
            if (!success) {
                setStatusMessage('Dieser Zug ist nicht erlaubt.');
                return;
            }
            pushMoveLog(playerColor, move);
            setHighlightSquares({ from: move.from, to: move.to });
            setSelectedSquare(null);
            syncState();
        },
        [isAiThinking, playerColor, pushMoveLog, syncState, turn]
    );

    const requestAiMove = useCallback(() => {
        const game = gameRef.current;
        if (game.isGameOver()) {
            return;
        }
        setIsAiThinking(true);
        setStatusMessage('KI denkt nach...');

        setTimeout(() => {
            let suggestion: ChessMoveSuggestion | null;
            try {
                suggestion = chooseChessMove(game.getFen(), aiColor);
            } catch (error) {
                console.error('Fehler beim Bestimmen des KI-Zuges:', error);
                const fallback = game.generateLegalMoves()[0];
                suggestion = {
                    move: fallback,
                    confidence: 0,
                    expectedScore: 0.5,
                    sampleSize: 0,
                    rationale: 'Fallback-Zug nach Fehler.',
                };
            }

            if (!suggestion) {
                setIsAiThinking(false);
                return;
            }

            const applied = game.makeMove(suggestion.move);
            if (!applied) {
                const fallback = game.generateLegalMoves()[0];
                game.makeMove(fallback);
                suggestion = {
                    ...suggestion,
                    move: fallback,
                    confidence: 0,
                    expectedScore: 0.5,
                    sampleSize: 0,
                    rationale: 'Fallback-Zug nach illegalem Vorschlag.',
                };
            }

            pushMoveLog(aiColor, suggestion.move);
            setHighlightSquares({ from: suggestion.move.from, to: suggestion.move.to });
            setLastAiExplanation(
                `${suggestion.rationale} Erwarteter Score ${(suggestion.expectedScore * 100).toFixed(1)}%, Vertrauen ${(suggestion.confidence * 100).toFixed(0)}%, Stichprobe ${suggestion.sampleSize}.`
            );
            setIsAiThinking(false);
            syncState();
        }, 250);
    }, [aiColor, pushMoveLog, syncState]);

    const handleSquareClick = useCallback(
        (square: string) => {
            if (gameRef.current.isGameOver() || isAiThinking || turn !== playerColor) {
                return;
            }

            if (selectedSquare === square) {
                setSelectedSquare(null);
                return;
            }

            if (!selectedSquare) {
                const game = gameRef.current;
                const board = game.getBoard();
                const { row, col } = squareToCoords(square);
                const piece = board[row][col];
                if (piece && piece.color === playerColor) {
                    setSelectedSquare(square);
                }
                return;
            }

            const candidateMoves = legalMoves.filter((move) => move.from === selectedSquare && move.to === square);
            if (candidateMoves.length === 0) {
                setSelectedSquare(null);
                return;
            }
            const preferredMove =
                candidateMoves.find((move) => move.promotion === 'q') ?? candidateMoves[0];
            handlePlayerMove(preferredMove);
        },
        [handlePlayerMove, isAiThinking, legalMoves, playerColor, selectedSquare, turn]
    );

    useEffect(() => {
        if (turn === aiColor && !isAiThinking && !gameOverInfo) {
            requestAiMove();
        }
    }, [aiColor, gameOverInfo, isAiThinking, requestAiMove, turn]);

    const renderBoard = () => {
        const rows = [];
        for (let displayRow = 0; displayRow < 8; displayRow++) {
            const boardRow = playerColor === 'white' ? displayRow : 7 - displayRow;
            const cells = [];
            for (let displayCol = 0; displayCol < 8; displayCol++) {
                const boardCol = playerColor === 'white' ? displayCol : 7 - displayCol;
                const square = squareName(boardRow, boardCol);
                const piece = boardState[boardRow][boardCol];
                const isDarkSquare = (boardRow + boardCol) % 2 === 1;
                const isSelected = selectedSquare === square;
                const isTarget = targetSquares.has(square);
                const isHighlighted = highlightSquares.from === square || highlightSquares.to === square;

                const baseColor = isDarkSquare ? 'bg-slate-700' : 'bg-slate-600';
                const selectionColor = isSelected ? 'ring-4 ring-yellow-400' : '';
                const targetColor = isTarget ? 'ring-4 ring-emerald-400' : '';
                const highlightColor = isHighlighted ? 'ring-4 ring-blue-400' : '';

                const pieceKey = piece ? `${piece.color[0]}${piece.type}` : null;
                const pieceSymbol = pieceKey ? PIECE_SYMBOLS[pieceKey] ?? '' : '';

                cells.push(
                    <button
                        key={square}
                        type="button"
                        onClick={() => handleSquareClick(square)}
                        className={`relative aspect-square flex items-center justify-center text-2xl font-semibold ${baseColor} rounded-md transition-transform hover:scale-[1.02] ${selectionColor} ${targetColor} ${highlightColor}`.trim()}
                    >
                        {pieceSymbol}
                        <span className="absolute bottom-1 right-1 text-[10px] text-slate-400">{square}</span>
                    </button>
                );
            }
            rows.push(
                <div key={`row-${displayRow}`} className="grid grid-cols-8 gap-1">
                    {cells}
                </div>
            );
        }
        return rows;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-3xl font-bold text-white">Runenkrieg · Schach-Arena</h1>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => onSwitchView('card')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-md transition"
                        >
                            Runenkrieg spielen
                        </button>
                        <button
                            onClick={() => onSwitchView('training')}
                            className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-md transition"
                        >
                            Trainings-Dashboard
                        </button>
                        <button
                            onClick={() => onSwitchView('shooter')}
                            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-md transition"
                        >
                            Arcade-Shooter
                        </button>
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-4 bg-slate-900/70 border border-slate-700 px-4 py-3 rounded-lg">
                                <span className="text-sm text-slate-300">Deine Farbe:</span>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="player-color"
                                        value="white"
                                        checked={playerColor === 'white'}
                                        onChange={() => setPlayerColor('white')}
                                        className="text-blue-500"
                                    />
                                    Weiß
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="player-color"
                                        value="black"
                                        checked={playerColor === 'black'}
                                        onChange={() => setPlayerColor('black')}
                                        className="text-blue-500"
                                    />
                                    Schwarz
                                </label>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={startNewGame}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-md transition"
                                >
                                    Neue Partie
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
                            <p className="text-sm text-slate-300">{statusMessage}</p>
                            {gameOverInfo && (
                                <p className="mt-2 text-sm text-amber-400">
                                    Gewinner: {gameOverInfo.winner} · Grund: {gameOverInfo.reason}
                                </p>
                            )}
                        </div>

                        <div className="relative">
                            <div className="grid gap-1 bg-slate-900/80 p-3 rounded-xl border border-slate-700 shadow-xl">
                                {renderBoard()}
                            </div>
                            {isAiThinking && !gameOverInfo && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center text-lg font-semibold">
                                    KI berechnet den nächsten Zug …
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="space-y-4">
                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-2">
                            <h2 className="text-xl font-semibold text-white">KI Status</h2>
                            <p className="text-sm text-slate-300">{aiStatus}</p>
                            {lastAiExplanation && (
                                <p className="text-sm text-slate-400">{lastAiExplanation}</p>
                            )}
                            <div className="mt-3 text-xs text-slate-500 break-all">
                                <p>Aktuelle FEN:</p>
                                <p className="mt-1 font-mono text-slate-300">{fen}</p>
                            </div>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                            <h2 className="text-xl font-semibold text-white mb-2">Zugverlauf</h2>
                            <div className="h-64 overflow-y-auto pr-2 text-sm space-y-1">
                                {moveLog.length === 0 ? (
                                    <p className="text-slate-500">Es wurden noch keine Züge gespielt.</p>
                                ) : (
                                    moveLog.map((entry, index) => (
                                        <p key={`${entry}-${index}`} className="font-mono text-slate-200">
                                            {index + 1}. {entry}
                                        </p>
                                    ))
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default ChessArena;

import {
    ChessColor,
    ChessMove,
    ChessPiece,
    ChessPieceType,
    ChessOutcome,
} from '../types';

type CastlingRights = {
    white: { kingSide: boolean; queenSide: boolean };
    black: { kingSide: boolean; queenSide: boolean };
};

type HistoryEntry = {
    move: ChessMove;
    capturedPiece: ChessPiece | null;
    previousEnPassant: string | null;
    previousCastling: CastlingRights;
    previousHalfmove: number;
    previousFullmove: number;
    previousResult: ChessOutcome | null;
    previousReason: string | null;
};

const FILES = 'abcdefgh';

const PIECE_VALUES: Record<ChessPieceType, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
};

const opposite = (color: ChessColor): ChessColor => (color === 'white' ? 'black' : 'white');

const cloneBoard = (board: (ChessPiece | null)[][]): (ChessPiece | null)[][] =>
    board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));

const cloneCastling = (rights: CastlingRights): CastlingRights => ({
    white: { ...rights.white },
    black: { ...rights.black },
});

const squareToCoords = (square: string): { row: number; col: number } => {
    const file = FILES.indexOf(square[0]);
    const rank = parseInt(square[1], 10);
    if (file < 0 || Number.isNaN(rank)) {
        throw new Error(`Ungültiges Feld: ${square}`);
    }
    return { row: 8 - rank, col: file };
};

const coordsToSquare = (row: number, col: number): string => {
    return `${FILES[col]}${8 - row}`;
};

const cloneMove = (move: ChessMove): ChessMove => ({ ...move });

const initialPlacement: (ChessPiece | null)[][] = [
    [
        { type: 'r', color: 'black' },
        { type: 'n', color: 'black' },
        { type: 'b', color: 'black' },
        { type: 'q', color: 'black' },
        { type: 'k', color: 'black' },
        { type: 'b', color: 'black' },
        { type: 'n', color: 'black' },
        { type: 'r', color: 'black' },
    ],
    Array.from({ length: 8 }, () => ({ type: 'p', color: 'black' } as ChessPiece)),
    Array.from({ length: 8 }, () => null),
    Array.from({ length: 8 }, () => null),
    Array.from({ length: 8 }, () => null),
    Array.from({ length: 8 }, () => null),
    Array.from({ length: 8 }, () => ({ type: 'p', color: 'white' } as ChessPiece)),
    [
        { type: 'r', color: 'white' },
        { type: 'n', color: 'white' },
        { type: 'b', color: 'white' },
        { type: 'q', color: 'white' },
        { type: 'k', color: 'white' },
        { type: 'b', color: 'white' },
        { type: 'n', color: 'white' },
        { type: 'r', color: 'white' },
    ],
];

const pawnStartRank = {
    white: 6,
    black: 1,
};

const pawnPromotionRank = {
    white: 0,
    black: 7,
};

export class SimpleChess {
    private board: (ChessPiece | null)[][];
    private turn: ChessColor;
    private castling: CastlingRights;
    private enPassant: string | null;
    private halfmoveClock: number;
    private fullmoveNumber: number;
    private history: HistoryEntry[];
    private result: ChessOutcome | null;
    private resultReason: string | null;

    constructor() {
        this.board = cloneBoard(initialPlacement);
        this.turn = 'white';
        this.castling = {
            white: { kingSide: true, queenSide: true },
            black: { kingSide: true, queenSide: true },
        };
        this.enPassant = null;
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;
        this.history = [];
        this.result = null;
        this.resultReason = null;
    }

    reset(): void {
        this.board = cloneBoard(initialPlacement);
        this.turn = 'white';
        this.castling = {
            white: { kingSide: true, queenSide: true },
            black: { kingSide: true, queenSide: true },
        };
        this.enPassant = null;
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;
        this.history = [];
        this.result = null;
        this.resultReason = null;
    }

    static fromFen(fen: string): SimpleChess {
        const game = new SimpleChess();
        game.loadFen(fen);
        return game;
    }

    getTurn(): ChessColor {
        return this.turn;
    }

    getBoard(): (ChessPiece | null)[][] {
        return cloneBoard(this.board);
    }

    getResult(): { outcome: ChessOutcome | null; reason: string | null } {
        return { outcome: this.result, reason: this.resultReason };
    }

    getHalfmoveClock(): number {
        return this.halfmoveClock;
    }

    getFullmoveNumber(): number {
        return this.fullmoveNumber;
    }

    private pieceAt(square: string): ChessPiece | null {
        const { row, col } = squareToCoords(square);
        return this.board[row][col];
    }

    private setPiece(square: string, piece: ChessPiece | null): void {
        const { row, col } = squareToCoords(square);
        this.board[row][col] = piece ? { ...piece } : null;
    }

    private findKing(color: ChessColor): string | null {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color && piece.type === 'k') {
                    return coordsToSquare(row, col);
                }
            }
        }
        return null;
    }

    private isSquareAttacked(square: string, byColor: ChessColor): boolean {
        const { row, col } = squareToCoords(square);
        const direction = byColor === 'white' ? -1 : 1;

        // Pawn attacks
        const pawnRows = row + direction;
        if (pawnRows >= 0 && pawnRows < 8) {
            for (const fileDelta of [-1, 1]) {
                const targetCol = col + fileDelta;
                if (targetCol >= 0 && targetCol < 8) {
                    const piece = this.board[pawnRows][targetCol];
                    if (piece && piece.color === byColor && piece.type === 'p') {
                        return true;
                    }
                }
            }
        }

        // Knight attacks
        const knightOffsets = [
            [2, 1],
            [2, -1],
            [-2, 1],
            [-2, -1],
            [1, 2],
            [1, -2],
            [-1, 2],
            [-1, -2],
        ];
        for (const [dr, dc] of knightOffsets) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const piece = this.board[nr][nc];
                if (piece && piece.color === byColor && piece.type === 'n') {
                    return true;
                }
            }
        }

        // King attacks
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    const piece = this.board[nr][nc];
                    if (piece && piece.color === byColor && piece.type === 'k') {
                        return true;
                    }
                }
            }
        }

        // Sliding pieces
        const directions: [number, number, ChessPieceType[]][] = [
            [1, 0, ['r', 'q']],
            [-1, 0, ['r', 'q']],
            [0, 1, ['r', 'q']],
            [0, -1, ['r', 'q']],
            [1, 1, ['b', 'q']],
            [1, -1, ['b', 'q']],
            [-1, 1, ['b', 'q']],
            [-1, -1, ['b', 'q']],
        ];

        for (const [dr, dc, attackers] of directions) {
            let nr = row + dr;
            let nc = col + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const piece = this.board[nr][nc];
                if (piece) {
                    if (piece.color === byColor && attackers.includes(piece.type)) {
                        return true;
                    }
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }

        return false;
    }

    private kingInCheck(color: ChessColor): boolean {
        const kingSquare = this.findKing(color);
        if (!kingSquare) {
            return false;
        }
        return this.isSquareAttacked(kingSquare, opposite(color));
    }

    private generatePseudoMoves(): ChessMove[] {
        const moves: ChessMove[] = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (!piece || piece.color !== this.turn) continue;
                const from = coordsToSquare(row, col);
                switch (piece.type) {
                    case 'p':
                        this.generatePawnMoves(piece, from, moves);
                        break;
                    case 'n':
                        this.generateKnightMoves(piece, from, moves);
                        break;
                    case 'b':
                        this.generateSlidingMoves(piece, from, moves, [
                            [1, 1],
                            [1, -1],
                            [-1, 1],
                            [-1, -1],
                        ]);
                        break;
                    case 'r':
                        this.generateSlidingMoves(piece, from, moves, [
                            [1, 0],
                            [-1, 0],
                            [0, 1],
                            [0, -1],
                        ]);
                        break;
                    case 'q':
                        this.generateSlidingMoves(piece, from, moves, [
                            [1, 0],
                            [-1, 0],
                            [0, 1],
                            [0, -1],
                            [1, 1],
                            [1, -1],
                            [-1, 1],
                            [-1, -1],
                        ]);
                        break;
                    case 'k':
                        this.generateKingMoves(piece, from, moves);
                        break;
                }
            }
        }
        return moves;
    }

    private generatePawnMoves(piece: ChessPiece, from: string, moves: ChessMove[]): void {
        const { row, col } = squareToCoords(from);
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = pawnStartRank[piece.color];
        const promotionRow = pawnPromotionRank[piece.color];

        const forwardRow = row + direction;
        if (forwardRow >= 0 && forwardRow < 8 && !this.board[forwardRow][col]) {
            const to = coordsToSquare(forwardRow, col);
            const isPromotion = forwardRow === promotionRow;
            moves.push({
                from,
                to,
                piece: piece.type,
                color: piece.color,
                isCapture: false,
                isPromotion,
                promotion: isPromotion ? 'q' : undefined,
                isEnPassant: false,
                isCastleKingSide: false,
                isCastleQueenSide: false,
            });

            if (row === startRow) {
                const doubleRow = row + direction * 2;
                if (!this.board[doubleRow][col]) {
                    moves.push({
                        from,
                        to: coordsToSquare(doubleRow, col),
                        piece: piece.type,
                        color: piece.color,
                        isCapture: false,
                        isPromotion: false,
                        isEnPassant: false,
                        isCastleKingSide: false,
                        isCastleQueenSide: false,
                    });
                }
            }
        }

        for (const dc of [-1, 1]) {
            const targetCol = col + dc;
            if (targetCol < 0 || targetCol >= 8) continue;
            const targetRow = row + direction;
            if (targetRow < 0 || targetRow >= 8) continue;
            const targetPiece = this.board[targetRow][targetCol];
            const to = coordsToSquare(targetRow, targetCol);
            const isPromotion = targetRow === promotionRow;

            if (targetPiece && targetPiece.color !== piece.color) {
                moves.push({
                    from,
                    to,
                    piece: piece.type,
                    color: piece.color,
                    captured: targetPiece.type,
                    isCapture: true,
                    isPromotion,
                    promotion: isPromotion ? 'q' : undefined,
                    isEnPassant: false,
                    isCastleKingSide: false,
                    isCastleQueenSide: false,
                });
            } else if (this.enPassant === to) {
                moves.push({
                    from,
                    to,
                    piece: piece.type,
                    color: piece.color,
                    captured: 'p',
                    isCapture: true,
                    isPromotion: false,
                    isEnPassant: true,
                    isCastleKingSide: false,
                    isCastleQueenSide: false,
                });
            }
        }
    }

    private generateKnightMoves(piece: ChessPiece, from: string, moves: ChessMove[]): void {
        const { row, col } = squareToCoords(from);
        const offsets = [
            [2, 1],
            [2, -1],
            [-2, 1],
            [-2, -1],
            [1, 2],
            [1, -2],
            [-1, 2],
            [-1, -2],
        ];

        for (const [dr, dc] of offsets) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
            const target = this.board[nr][nc];
            if (target && target.color === piece.color) continue;
            moves.push({
                from,
                to: coordsToSquare(nr, nc),
                piece: piece.type,
                color: piece.color,
                captured: target?.type,
                isCapture: Boolean(target),
                isPromotion: false,
                isEnPassant: false,
                isCastleKingSide: false,
                isCastleQueenSide: false,
            });
        }
    }

    private generateSlidingMoves(
        piece: ChessPiece,
        from: string,
        moves: ChessMove[],
        directions: [number, number][]
    ): void {
        const { row, col } = squareToCoords(from);
        for (const [dr, dc] of directions) {
            let nr = row + dr;
            let nc = col + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (target) {
                    if (target.color !== piece.color) {
                        moves.push({
                            from,
                            to: coordsToSquare(nr, nc),
                            piece: piece.type,
                            color: piece.color,
                            captured: target.type,
                            isCapture: true,
                            isPromotion: false,
                            isEnPassant: false,
                            isCastleKingSide: false,
                            isCastleQueenSide: false,
                        });
                    }
                    break;
                }
                moves.push({
                    from,
                    to: coordsToSquare(nr, nc),
                    piece: piece.type,
                    color: piece.color,
                    isCapture: false,
                    isPromotion: false,
                    isEnPassant: false,
                    isCastleKingSide: false,
                    isCastleQueenSide: false,
                });
                nr += dr;
                nc += dc;
            }
        }
    }

    private generateKingMoves(piece: ChessPiece, from: string, moves: ChessMove[]): void {
        const { row, col } = squareToCoords(from);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
                const target = this.board[nr][nc];
                if (target && target.color === piece.color) continue;
                moves.push({
                    from,
                    to: coordsToSquare(nr, nc),
                    piece: piece.type,
                    color: piece.color,
                    captured: target?.type,
                    isCapture: Boolean(target),
                    isPromotion: false,
                    isEnPassant: false,
                    isCastleKingSide: false,
                    isCastleQueenSide: false,
                });
            }
        }

        if (this.kingInCheck(piece.color)) {
            return;
        }

        const rights = this.castling[piece.color];
        const baseRank = piece.color === 'white' ? '1' : '8';

        if (rights.kingSide) {
            const fSquare = `f${baseRank}`;
            const gSquare = `g${baseRank}`;
            if (!this.pieceAt(fSquare) && !this.pieceAt(gSquare)) {
                if (!this.isSquareAttacked(fSquare, opposite(piece.color)) && !this.isSquareAttacked(gSquare, opposite(piece.color))) {
                    moves.push({
                        from,
                        to: gSquare,
                        piece: piece.type,
                        color: piece.color,
                        isCapture: false,
                        isPromotion: false,
                        isEnPassant: false,
                        isCastleKingSide: true,
                        isCastleQueenSide: false,
                    });
                }
            }
        }

        if (rights.queenSide) {
            const dSquare = `d${baseRank}`;
            const cSquare = `c${baseRank}`;
            const bSquare = `b${baseRank}`;
            if (!this.pieceAt(dSquare) && !this.pieceAt(cSquare) && !this.pieceAt(bSquare)) {
                if (!this.isSquareAttacked(dSquare, opposite(piece.color)) && !this.isSquareAttacked(cSquare, opposite(piece.color))) {
                    moves.push({
                        from,
                        to: cSquare,
                        piece: piece.type,
                        color: piece.color,
                        isCapture: false,
                        isPromotion: false,
                        isEnPassant: false,
                        isCastleKingSide: false,
                        isCastleQueenSide: true,
                    });
                }
            }
        }
    }

    private applyMove(move: ChessMove): HistoryEntry {
        const previousState: HistoryEntry = {
            move: cloneMove(move),
            capturedPiece: null,
            previousEnPassant: this.enPassant,
            previousCastling: cloneCastling(this.castling),
            previousHalfmove: this.halfmoveClock,
            previousFullmove: this.fullmoveNumber,
            previousResult: this.result,
            previousReason: this.resultReason,
        };

        const movingPiece = this.pieceAt(move.from);
        if (!movingPiece) {
            throw new Error(`Keine Figur auf ${move.from}`);
        }

        let captureSquare = move.to;
        if (move.isEnPassant) {
            const direction = move.color === 'white' ? 1 : -1;
            const { row, col } = squareToCoords(move.to);
            const capturedRow = row + direction;
            captureSquare = coordsToSquare(capturedRow, col);
        }

        const capturedPiece = this.pieceAt(captureSquare);
        previousState.capturedPiece = capturedPiece ? { ...capturedPiece } : null;

        this.setPiece(move.from, null);

        const promotedType = move.isPromotion ? move.promotion ?? 'q' : movingPiece.type;
        const placedPiece: ChessPiece = {
            type: promotedType,
            color: movingPiece.color,
        };
        this.setPiece(move.to, placedPiece);

        if (move.isEnPassant && capturedPiece) {
            this.setPiece(captureSquare, null);
        }

        if (move.piece === 'k') {
            const rights = this.castling[move.color];
            rights.kingSide = false;
            rights.queenSide = false;

            if (move.isCastleKingSide) {
                const rookFrom = move.color === 'white' ? 'h1' : 'h8';
                const rookTo = move.color === 'white' ? 'f1' : 'f8';
                const rook = this.pieceAt(rookFrom);
                if (rook) {
                    this.setPiece(rookFrom, null);
                    this.setPiece(rookTo, rook);
                }
            }

            if (move.isCastleQueenSide) {
                const rookFrom = move.color === 'white' ? 'a1' : 'a8';
                const rookTo = move.color === 'white' ? 'd1' : 'd8';
                const rook = this.pieceAt(rookFrom);
                if (rook) {
                    this.setPiece(rookFrom, null);
                    this.setPiece(rookTo, rook);
                }
            }
        }

        if (move.piece === 'r') {
            if (move.from === 'a1' || move.to === 'a1') {
                this.castling.white.queenSide = false;
            }
            if (move.from === 'h1' || move.to === 'h1') {
                this.castling.white.kingSide = false;
            }
            if (move.from === 'a8' || move.to === 'a8') {
                this.castling.black.queenSide = false;
            }
            if (move.from === 'h8' || move.to === 'h8') {
                this.castling.black.kingSide = false;
            }
        }

        if (capturedPiece && capturedPiece.type === 'r') {
            const square = captureSquare;
            if (square === 'a1') this.castling.white.queenSide = false;
            if (square === 'h1') this.castling.white.kingSide = false;
            if (square === 'a8') this.castling.black.queenSide = false;
            if (square === 'h8') this.castling.black.kingSide = false;
        }

        this.enPassant = null;
        if (move.piece === 'p' && Math.abs(squareToCoords(move.to).row - squareToCoords(move.from).row) === 2) {
            const middleRow = (squareToCoords(move.to).row + squareToCoords(move.from).row) / 2;
            this.enPassant = coordsToSquare(middleRow, squareToCoords(move.from).col);
        }

        if (move.piece === 'p' || move.isCapture) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock += 1;
        }

        if (move.color === 'black') {
            this.fullmoveNumber += 1;
        }

        this.turn = opposite(this.turn);

        return previousState;
    }

    private revertMove(entry: HistoryEntry): void {
        const move = entry.move;
        const movedPiece = this.pieceAt(move.to);
        this.setPiece(move.to, null);
        this.setPiece(move.from, movedPiece ? { type: move.piece, color: move.color } : null);

        if (move.isEnPassant && entry.capturedPiece) {
            const direction = move.color === 'white' ? 1 : -1;
            const { row, col } = squareToCoords(move.to);
            const captureSquare = coordsToSquare(row + direction, col);
            this.setPiece(captureSquare, entry.capturedPiece);
        } else if (entry.capturedPiece) {
            this.setPiece(move.to, entry.capturedPiece);
        }

        if (move.isCastleKingSide) {
            const rookFrom = move.color === 'white' ? 'h1' : 'h8';
            const rookTo = move.color === 'white' ? 'f1' : 'f8';
            const rook = this.pieceAt(rookTo);
            if (rook) {
                this.setPiece(rookTo, null);
                this.setPiece(rookFrom, rook);
            }
        }

        if (move.isCastleQueenSide) {
            const rookFrom = move.color === 'white' ? 'a1' : 'a8';
            const rookTo = move.color === 'white' ? 'd1' : 'd8';
            const rook = this.pieceAt(rookTo);
            if (rook) {
                this.setPiece(rookTo, null);
                this.setPiece(rookFrom, rook);
            }
        }

        this.castling = cloneCastling(entry.previousCastling);
        this.enPassant = entry.previousEnPassant;
        this.halfmoveClock = entry.previousHalfmove;
        this.fullmoveNumber = entry.previousFullmove;
        this.turn = move.color;
        this.result = entry.previousResult;
        this.resultReason = entry.previousReason;
    }

    generateLegalMoves(): ChessMove[] {
        const pseudoMoves = this.generatePseudoMoves();
        const legalMoves: ChessMove[] = [];
        for (const move of pseudoMoves) {
            const state = this.applyMove(move);
            const kingInCheck = this.kingInCheck(move.color);
            const opponentCheck = this.kingInCheck(opposite(move.color));
            this.revertMove(state);
            if (!kingInCheck) {
                legalMoves.push({ ...move, resultsInCheck: opponentCheck });
            }
        }
        return legalMoves;
    }

    makeMove(moveInput: ChessMove | string): boolean {
        const move = typeof moveInput === 'string' ? this.parseMove(moveInput) : moveInput;
        if (!move) {
            return false;
        }
        const legalMoves = this.generateLegalMoves();
        const found = legalMoves.find(
            (legal) =>
                legal.from === move.from &&
                legal.to === move.to &&
                (legal.promotion ?? null) === (move.promotion ?? null)
        );
        if (!found) {
            return false;
        }

        const state = this.applyMove(found);
        this.history.push(state);
        this.updateGameState();
        return true;
    }

    undo(): boolean {
        const entry = this.history.pop();
        if (!entry) {
            return false;
        }
        this.revertMove(entry);
        return true;
    }

    private updateGameState(): void {
        if (this.kingInCheck(opposite(this.turn))) {
            // Should never happen immediately after move
            this.result = opposite(this.turn);
            this.resultReason = 'illegal';
            return;
        }

        const legalMoves = this.generatePseudoMovesFilteredForOpponent();
        if (legalMoves.length === 0) {
            if (this.kingInCheck(this.turn)) {
                this.result = opposite(this.turn);
                this.resultReason = 'checkmate';
            } else {
                this.result = 'draw';
                this.resultReason = 'stalemate';
            }
            return;
        }

        if (this.halfmoveClock >= 100) {
            this.result = 'draw';
            this.resultReason = 'fiftyMove';
            return;
        }

        this.result = null;
        this.resultReason = null;
    }

    private generatePseudoMovesFilteredForOpponent(): ChessMove[] {
        const colorToMove = this.turn;
        const moves: ChessMove[] = [];
        const pseudo = this.generatePseudoMoves();
        for (const move of pseudo) {
            const state = this.applyMove(move);
            const inCheck = this.kingInCheck(move.color);
            this.revertMove(state);
            if (!inCheck) {
                moves.push(move);
            }
        }
        return moves.filter((move) => move.color === colorToMove);
    }

    isGameOver(): boolean {
        return this.result !== null;
    }

    getOutcome(): ChessOutcome | null {
        return this.result;
    }

    getOutcomeReason(): string | null {
        return this.resultReason;
    }

    isInCheck(color: ChessColor): boolean {
        return this.kingInCheck(color);
    }

    private parseMove(uci: string): ChessMove | null {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
            return null;
        }
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotionSymbol = uci[4] as ChessPieceType | undefined;
        const piece = this.pieceAt(from);
        if (!piece) {
            return null;
        }
        return {
            from,
            to,
            piece: piece.type,
            color: piece.color,
            promotion: promotionSymbol,
            isCapture: Boolean(this.pieceAt(to)),
            isPromotion: Boolean(promotionSymbol),
            isEnPassant: false,
            isCastleKingSide: false,
            isCastleQueenSide: false,
        };
    }

    toUci(move: ChessMove): string {
        return `${move.from}${move.to}${move.promotion ?? ''}`;
    }

    getFen(): string {
        const pieceToSymbol: Record<string, string> = {
            wp: 'P',
            wn: 'N',
            wb: 'B',
            wr: 'R',
            wq: 'Q',
            wk: 'K',
            bp: 'p',
            bn: 'n',
            bb: 'b',
            br: 'r',
            bq: 'q',
            bk: 'k',
        };

        const rows: string[] = [];
        for (let row = 0; row < 8; row++) {
            let rowString = '';
            let empty = 0;
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (!piece) {
                    empty += 1;
                    continue;
                }
                if (empty > 0) {
                    rowString += empty.toString();
                    empty = 0;
                }
                rowString += pieceToSymbol[`${piece.color[0]}${piece.type}`];
            }
            if (empty > 0) {
                rowString += empty.toString();
            }
            rows.push(rowString);
        }

        let castling = '';
        if (this.castling.white.kingSide) castling += 'K';
        if (this.castling.white.queenSide) castling += 'Q';
        if (this.castling.black.kingSide) castling += 'k';
        if (this.castling.black.queenSide) castling += 'q';
        if (!castling) castling = '-';

        const enPassant = this.enPassant ?? '-';

        return [
            rows.join('/'),
            this.turn === 'white' ? 'w' : 'b',
            castling,
            enPassant,
            this.halfmoveClock.toString(),
            this.fullmoveNumber.toString(),
        ].join(' ');
    }

    loadFen(fen: string): void {
        const parts = fen.trim().split(/\s+/);
        if (parts.length < 4) {
            throw new Error('Ungültige FEN-Zeile');
        }
        const [boardPart, turnPart, castlingPart, enPassantPart, halfmovePart, fullmovePart] = parts;
        const rows = boardPart.split('/');
        if (rows.length !== 8) {
            throw new Error('Ungültige Brettbeschreibung in FEN');
        }

        this.board = Array.from({ length: 8 }, () =>
            Array.from({ length: 8 }, () => null as ChessPiece | null)
        );

        const symbolToPiece: Record<string, ChessPiece> = {
            p: { type: 'p', color: 'black' },
            n: { type: 'n', color: 'black' },
            b: { type: 'b', color: 'black' },
            r: { type: 'r', color: 'black' },
            q: { type: 'q', color: 'black' },
            k: { type: 'k', color: 'black' },
            P: { type: 'p', color: 'white' },
            N: { type: 'n', color: 'white' },
            B: { type: 'b', color: 'white' },
            R: { type: 'r', color: 'white' },
            Q: { type: 'q', color: 'white' },
            K: { type: 'k', color: 'white' },
        };

        for (let row = 0; row < 8; row++) {
            const fenRow = rows[row];
            let col = 0;
            for (const symbol of fenRow.split('')) {
                if (/[1-8]/.test(symbol)) {
                    col += parseInt(symbol, 10);
                    continue;
                }
                const piece = symbolToPiece[symbol];
                if (!piece) {
                    throw new Error(`Ungültiges FEN-Symbol: ${symbol}`);
                }
                this.board[row][col] = { ...piece };
                col += 1;
            }
            if (col !== 8) {
                throw new Error('FEN-Reihe hat nicht acht Spalten');
            }
        }

        this.turn = turnPart === 'w' ? 'white' : 'black';

        this.castling = {
            white: { kingSide: false, queenSide: false },
            black: { kingSide: false, queenSide: false },
        };

        if (castlingPart && castlingPart !== '-') {
            if (castlingPart.includes('K')) this.castling.white.kingSide = true;
            if (castlingPart.includes('Q')) this.castling.white.queenSide = true;
            if (castlingPart.includes('k')) this.castling.black.kingSide = true;
            if (castlingPart.includes('q')) this.castling.black.queenSide = true;
        }

        this.enPassant = enPassantPart && enPassantPart !== '-' ? enPassantPart : null;
        this.halfmoveClock = halfmovePart ? parseInt(halfmovePart, 10) : 0;
        this.fullmoveNumber = fullmovePart ? parseInt(fullmovePart, 10) : 1;
        if (Number.isNaN(this.halfmoveClock)) this.halfmoveClock = 0;
        if (Number.isNaN(this.fullmoveNumber)) this.fullmoveNumber = 1;

        this.history = [];
        this.result = null;
        this.resultReason = null;
    }

    evaluateMaterialBalance(color: ChessColor): number {
        let total = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (!piece) continue;
                const value = PIECE_VALUES[piece.type];
                total += piece.color === color ? value : -value;
            }
        }
        return total;
    }
}

export const PIECE_SYMBOLS: Record<string, string> = {
    wk: '♔',
    wq: '♕',
    wr: '♖',
    wb: '♗',
    wn: '♘',
    wp: '♙',
    bk: '♚',
    bq: '♛',
    br: '♜',
    bb: '♝',
    bn: '♞',
    bp: '♟︎',
};

export const getPieceValue = (type: ChessPieceType): number => PIECE_VALUES[type];

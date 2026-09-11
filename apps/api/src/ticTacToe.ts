import { TicTacToeGame, TicTacToeMark } from "@chatapp/shared";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export type ApplyMoveResult = { success: true; game: TicTacToeGame } | { success: false; error: string };

/**
 * Snapchat/Bumble's real "play a mini-game within chat to break the ice"
 * (#148) — a genuinely playable two-player game (Tic-Tac-Toe) rather than
 * a fabricated "AI-generated game" this app has no engine or model for.
 * Real chat games (Snapchat's built-in games, Bumble's own icebreaker
 * game) are exactly this shape: simple, turn-based, no external engine
 * needed. `playerX` always moves first, matching every real Tic-Tac-Toe
 * implementation's convention.
 */
export function createGame(playerX: string, playerO: string): TicTacToeGame {
  return {
    board: Array(9).fill(null),
    playerX,
    playerO,
    turn: "X",
    winner: null,
  };
}

function computeWinner(board: TicTacToeGame["board"]): TicTacToeMark | "draw" | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as TicTacToeMark;
    }
  }
  return board.every((cell) => cell !== null) ? "draw" : null;
}

/**
 * Validates and applies a single move: the game must not already be over,
 * it must be `player`'s turn (derived from whichever mark is on move, not
 * a separately-tracked "current player" field — one less thing that could
 * drift out of sync with the board), and the target cell must be empty
 * and in range. Returns a new game object rather than mutating the one
 * passed in, same "pure function, caller decides what to do with the
 * result" shape as swipes.ts's recordSwipe().
 */
export function applyMove(game: TicTacToeGame, player: string, cellIndex: unknown): ApplyMoveResult {
  if (game.winner) {
    return { success: false, error: "This game is already over" };
  }

  const mark = game.turn;
  const expectedPlayer = mark === "X" ? game.playerX : game.playerO;
  if (player !== expectedPlayer) {
    return { success: false, error: "It's not your turn" };
  }

  if (typeof cellIndex !== "number" || !Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) {
    return { success: false, error: "cellIndex must be an integer between 0 and 8" };
  }
  if (game.board[cellIndex] !== null) {
    return { success: false, error: "That cell is already taken" };
  }

  const board = [...game.board];
  board[cellIndex] = mark;

  return {
    success: true,
    game: { ...game, board, winner: computeWinner(board), turn: mark === "X" ? "O" : "X" },
  };
}

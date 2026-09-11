import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyMove } from "./ticTacToe";

test("createGame() starts with an empty board and X to move", () => {
  const game = createGame("alice", "bob");
  assert.deepEqual(game.board, Array(9).fill(null));
  assert.equal(game.turn, "X");
  assert.equal(game.winner, null);
  assert.equal(game.playerX, "alice");
  assert.equal(game.playerO, "bob");
});

test("applyMove() rejects a move from the player who isn't on turn", () => {
  const game = createGame("alice", "bob");
  const result = applyMove(game, "bob", 0);
  assert.equal(result.success, false);
});

test("applyMove() places the mover's mark and flips the turn", () => {
  const game = createGame("alice", "bob");
  const result = applyMove(game, "alice", 4);
  assert.equal(result.success, true);
  assert.equal(result.success && result.game.board[4], "X");
  assert.equal(result.success && result.game.turn, "O");
});

test("applyMove() rejects an already-taken cell", () => {
  const game = createGame("alice", "bob");
  const afterX = applyMove(game, "alice", 0);
  const result = applyMove(afterX.success ? afterX.game : game, "bob", 0);
  assert.equal(result.success, false);
});

test("applyMove() rejects an out-of-range cellIndex", () => {
  const game = createGame("alice", "bob");
  const result = applyMove(game, "alice", 9);
  assert.equal(result.success, false);
});

test("applyMove() rejects a non-integer cellIndex", () => {
  const game = createGame("alice", "bob");
  const result = applyMove(game, "alice", 1.5);
  assert.equal(result.success, false);
});

test("applyMove() detects a row win for X", () => {
  let game = createGame("alice", "bob");
  const moves: [string, number][] = [
    ["alice", 0],
    ["bob", 3],
    ["alice", 1],
    ["bob", 4],
    ["alice", 2],
  ];
  for (const [player, cell] of moves) {
    const result = applyMove(game, player, cell);
    assert.equal(result.success, true);
    if (result.success) game = result.game;
  }
  assert.equal(game.winner, "X");
});

test("applyMove() detects a diagonal win for O", () => {
  let game = createGame("alice", "bob");
  const moves: [string, number][] = [
    ["alice", 1],
    ["bob", 0],
    ["alice", 2],
    ["bob", 4],
    ["alice", 5],
    ["bob", 8],
  ];
  for (const [player, cell] of moves) {
    const result = applyMove(game, player, cell);
    assert.equal(result.success, true);
    if (result.success) game = result.game;
  }
  assert.equal(game.winner, "O");
});

test("applyMove() detects a draw when the board fills with no winner", () => {
  let game = createGame("alice", "bob");
  // X O X / X O O / O X X -> no winner, board full
  const moves: [string, number][] = [
    ["alice", 0],
    ["bob", 1],
    ["alice", 2],
    ["bob", 4],
    ["alice", 3],
    ["bob", 5],
    ["alice", 7],
    ["bob", 6],
    ["alice", 8],
  ];
  for (const [player, cell] of moves) {
    const result = applyMove(game, player, cell);
    assert.equal(result.success, true);
    if (result.success) game = result.game;
  }
  assert.equal(game.winner, "draw");
});

test("applyMove() rejects any further move once the game is over", () => {
  let game = createGame("alice", "bob");
  const moves: [string, number][] = [
    ["alice", 0],
    ["bob", 3],
    ["alice", 1],
    ["bob", 4],
    ["alice", 2],
  ];
  for (const [player, cell] of moves) {
    const result = applyMove(game, player, cell);
    if (result.success) game = result.game;
  }
  assert.equal(game.winner, "X");
  const result = applyMove(game, "bob", 5);
  assert.equal(result.success, false);
});

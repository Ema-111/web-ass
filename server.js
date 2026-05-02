const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
 
const PORT = 8080;
const BOARD_SIZE = 4;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const TURN_TIMEOUT_MS = 60 * 1000;
 
const COLORS = ["rose", "lavender", "mint", "sky"];
const SHAPES = ["square", "triangle", "circle", "star"];
 
const app = express();
const server = http.createServer(app);
const io = new Server(server);
 
app.use("/public", express.static(path.join(__dirname, "public")));
 
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});
 
app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "about.html"));
});
 
app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "game.html"));
});
 
app.get("/report.html", (req, res) => {
  res.sendFile(path.join(__dirname, "report.html"));
});
 
const game = {
  board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
  pool: [],
  players: [],
  currentTurnIndex: 0,
  currentBlock: null,
  turnExpiresAt: null,
  timerId: null
};
 
function createPool() {
  const blocks = [];
  for (const color of COLORS) {
    for (const shape of SHAPES) {
      blocks.push({ id: `${color}-${shape}`, color, shape });
    }
  }
  return blocks;
}
 
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
 
function currentPlayer() {
  return game.players[game.currentTurnIndex] || null;
}
 
function publicState() {
  const cp = currentPlayer();
  return {
    board: game.board,
    poolSize: game.pool.length,
    players: game.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    currentPlayerId: cp ? cp.id : null,
    currentPlayerName: cp ? cp.name : null,
    turnExpiresAt: game.turnExpiresAt
  };
}
 
function emitState() {
  io.emit("game:state", publicState());
}
 
function clearExistingTimer() {
  if (game.timerId) {
    clearTimeout(game.timerId);
    game.timerId = null;
  }
}
 
function handleTurnTimeout(playerId) {
  const cp = currentPlayer();
  if (!cp || cp.id !== playerId) return;
  if (game.currentBlock) {
    game.pool.push(game.currentBlock);
    game.currentBlock = null;
  }
  game.turnExpiresAt = null;
  game.timerId = null;
  removePlayer(playerId, "Timed out");
}
 
function resetTimer() {
  clearExistingTimer();
  if (!currentPlayer() || !game.currentBlock) {
    game.turnExpiresAt = null;
    return;
  }
  game.turnExpiresAt = Date.now() + TURN_TIMEOUT_MS;
  const activeId = currentPlayer().id;
  game.timerId = setTimeout(() => handleTurnTimeout(activeId), TURN_TIMEOUT_MS);
}
 
function chooseNextBlock() {
  if (game.pool.length === 0) {
    // Pool should never truly be empty during normal play because
    // matched / jackpot blocks are returned to it.  If it is empty
    // (e.g. during early testing) create a fresh shuffled set so
    // the game can continue gracefully.
    game.pool = shuffle(createPool());
  }
  const index = Math.floor(Math.random() * game.pool.length);
  const [block] = game.pool.splice(index, 1);
  return block;
}
 
function nextBlockForCurrentPlayer() {
  const cp = currentPlayer();
  if (!cp) {
    game.currentBlock = null;
    clearExistingTimer();
    game.turnExpiresAt = null;
    emitState();
    return;
  }
 
  game.currentBlock = chooseNextBlock();
  resetTimer();
  emitState();
  io.to(cp.id).emit("game:your-block", game.currentBlock);
}
 
function nextTurn() {
  if (game.players.length === 0) {
    game.currentTurnIndex = 0;
    game.currentBlock = null;
    clearExistingTimer();
    game.turnExpiresAt = null;
    emitState();
    return;
  }
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
  nextBlockForCurrentPlayer();
}
 
function inBounds(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}
 
function findMatches() {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  const matched = new Set();
 
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const startCell = game.board[r][c];
      if (!startCell) continue;
 
      for (const [dr, dc] of directions) {
        for (const key of ["color", "shape"]) {
          const prevR = r - dr;
          const prevC = c - dc;
          if (
            inBounds(prevR, prevC) &&
            game.board[prevR][prevC] &&
            game.board[prevR][prevC][key] === startCell[key]
          ) {
            continue;
          }
 
          let rr = r;
          let cc = c;
          const line = [];
          while (
            inBounds(rr, cc) &&
            game.board[rr][cc] &&
            game.board[rr][cc][key] === startCell[key]
          ) {
            line.push([rr, cc]);
            rr += dr;
            cc += dc;
          }
          if (line.length >= 3) {
            line.forEach(([lr, lc]) => matched.add(`${lr},${lc}`));
          }
        }
      }
    }
  }
  return matched;
}
 
function removeMatchedAndScore(player) {
  const matched = findMatches();
  let removed = 0;
  matched.forEach((pos) => {
    const [r, c] = pos.split(",").map(Number);
    const block = game.board[r][c];
    if (block) {
      game.pool.push(block);
      game.board[r][c] = null;
      removed += 1;
    }
  });
  if (removed > 0) player.score += removed;
  return removed;
}
 
function isBoardFull() {
  return game.board.every((row) => row.every((cell) => cell !== null));
}
 
function clearBoardJackpot(player) {
  if (!isBoardFull()) return false;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const block = game.board[r][c];
      if (block) {
        game.pool.push(block);
        game.board[r][c] = null;
      }
    }
  }
  player.score += BOARD_CELLS;
  return true;
}
 
function removePlayer(socketId, reason) {
  const idx = game.players.findIndex((p) => p.id === socketId);
  if (idx === -1) return;
 
  const wasCurrent = idx === game.currentTurnIndex;
  const [leftPlayer] = game.players.splice(idx, 1);
 
  if (idx < game.currentTurnIndex) game.currentTurnIndex -= 1;
  if (game.currentTurnIndex >= game.players.length) game.currentTurnIndex = 0;
 
  io.to(leftPlayer.id).emit("game:message", `${reason}, removed from game.`);
  io.emit("game:message", `${leftPlayer.name} ${reason.toLowerCase()}.`);
  emitState();
 
  if (wasCurrent) {
    if (game.currentBlock) {
      game.pool.push(game.currentBlock);
      game.currentBlock = null;
    }
    nextBlockForCurrentPlayer();
  }
}
 
io.on("connection", (socket) => {
  socket.emit("game:state", publicState());
  socket.emit("game:message", "Connected. Please enter your name.");
 
  socket.on("game:join", (rawName) => {
    const name = String(rawName || "").trim().slice(0, 20);
    if (!name) {
      socket.emit("game:message", "Name is required.");
      return;
    }
    if (game.players.find((p) => p.id === socket.id)) return;
 
    game.players.push({ id: socket.id, name, score: 0 });
    socket.emit("game:message", `Welcome, ${name}.`);
    emitState();
 
    if (game.players.length === 1) {
      // First player: start the game from scratch.
      game.currentTurnIndex = 0;
      nextBlockForCurrentPlayer();
    } else if (!game.currentBlock && currentPlayer()) {
      // FIX (server): The game was paused because all previous players
      // left (currentBlock became null with no active player).  Now
      // that someone has joined again, resume by handing the current
      // player their block so the game continues automatically.
      nextBlockForCurrentPlayer();
    }
  });
 
  socket.on("game:leave", () => removePlayer(socket.id, "Left the game"));
 
  socket.on("game:place", ({ row, col }) => {
    const cp = currentPlayer();
    if (!cp) return socket.emit("game:message", "Waiting for players.");
    if (cp.id !== socket.id) return socket.emit("game:message", "Not your turn.");
    if (!game.currentBlock) return socket.emit("game:message", "No block assigned.");
    if (!inBounds(row, col)) return socket.emit("game:message", "Invalid cell.");
    if (game.board[row][col]) return socket.emit("game:message", "Cell occupied.");
 
    const placed = game.currentBlock;
    game.board[row][col] = placed;
    game.currentBlock = null;
 
    let removed = 0;
    const jackpot = clearBoardJackpot(cp);
    if (!jackpot) {
      removed = removeMatchedAndScore(cp);
    }
 
    let msg = `${cp.name} placed ${placed.color} ${placed.shape}.`;
    if (removed > 0) msg += ` Cleared ${removed} blocks (+${removed}).`;
    if (jackpot) msg += ` Jackpot! +${BOARD_CELLS} points.`;
    io.emit("game:message", msg);
 
    nextTurn();
  });
 
  socket.on("disconnect", () => removePlayer(socket.id, "Disconnected"));
});
 
game.pool = shuffle(createPool());
 
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
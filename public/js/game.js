const socket = io();

const boardEl = document.getElementById("board");
const joinBtn = document.getElementById("join-btn");
const nameInput = document.getElementById("name-input");
const statusText = document.getElementById("status-text");
const playerList = document.getElementById("player-list");
const turnName = document.getElementById("turn-name");
const poolSize = document.getElementById("pool-size");
const myBlock = document.getElementById("my-block");
const timerText = document.getElementById("timer-text");

const BOARD_SIZE = 4;

// FIX 1: socket.id is available immediately on creation,
// so initialise here instead of waiting for the "connect" event.
// This avoids the race condition where game:state arrives before
// the connect handler has run and myId is still "".
let myId = socket.id || "";
let myTurn = false;
let assignedBlock = null;
let timerId = null;

// Keep a local copy of the board so the front end can validate
// placements without a round-trip to the server.
let localBoard = Array.from({ length: BOARD_SIZE }, () =>
  Array(BOARD_SIZE).fill(null)
);

function renderShape(block) {
  if (!block) return "";
  return `<span class="shape ${block.shape} ${block.color}"></span>`;
}

function createBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.dataset.row = String(r);
      btn.dataset.col = String(c);
      btn.addEventListener("click", onPlace);
      boardEl.appendChild(btn);
    }
  }
}

function onPlace(event) {
  if (!myTurn) {
    statusText.textContent = "Not your turn now.";
    return;
  }
  if (!assignedBlock) {
    statusText.textContent = "Waiting for your random block...";
    return;
  }

  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);

  // FIX 3: Validate locally before sending to avoid the unnecessary
  // network round-trip and give instant feedback to the player.
  if (localBoard[row][col]) {
    statusText.textContent = "That cell is already occupied. Pick another.";
    return;
  }

  socket.emit("game:place", { row, col });
}

function updateTimer(expiresAt) {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (!expiresAt) {
    timerText.textContent = "-";
    return;
  }

  const tick = () => {
    const remain = Math.max(0, expiresAt - Date.now());
    timerText.textContent = `${Math.ceil(remain / 1000)}s`;
    if (remain === 0) {
      clearInterval(timerId);
      timerId = null;
    }
  };
  tick();
  timerId = setInterval(tick, 500);
}

function renderState(state) {
  // Update local board copy for front-end validation (FIX 3).
  // Use deep copy to avoid sync issues
  localBoard = state.board.map(row => [...row]);

  const cells = boardEl.querySelectorAll(".cell");
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const idx = r * BOARD_SIZE + c;
      const cell = cells[idx];
      const blockData = state.board[r][c];

      cell.innerHTML = renderShape(blockData);

      // FIX 4: Mark occupied cells with class instead of disabled attribute
      // to keep them clickable for visual feedback
      if (blockData) {
        cell.classList.add("occupied");
      } else {
        cell.classList.remove("occupied");
      }
    }
  }

  playerList.innerHTML = "";
  state.players.forEach((player) => {
    const li = document.createElement("li");
    const me = player.id === myId ? " (You)" : "";
    const current = player.id === state.currentPlayerId ? " ← Turn" : "";
    li.textContent = `${player.name}${me}: ${player.score}${current}`;
    playerList.appendChild(li);
  });

  turnName.textContent = state.currentPlayerName || "-";
  poolSize.textContent = String(state.poolSize);

  const wasMyTurn = myTurn;
  myTurn = state.currentPlayerId === myId;

  // FIX 2: Only clear the assigned block when the turn actually
  // switches away from this player.  Previously assignedBlock was
  // wiped on every state update where myTurn was false, which could
  // race with the game:your-block message and clear a freshly
  // assigned block before the player had a chance to use it.
  if (wasMyTurn && !myTurn) {
    assignedBlock = null;
    myBlock.textContent = "None";
  }

  updateTimer(state.turnExpiresAt);
}

// FIX 1 (continued): keep myId in sync after reconnections.
socket.on("connect", () => {
  myId = socket.id;
});

// FIX 5: Clear the countdown timer when the socket disconnects so
// the interval does not keep firing after the connection is lost.
socket.on("disconnect", () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  timerText.textContent = "-";
  statusText.textContent = "Disconnected from server.";
});

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) {
    statusText.textContent = "Please enter a name first.";
    return;
  }
  socket.emit("game:join", name);
});

// Allow pressing Enter in the name field to join.
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

socket.on("game:state", renderState);

socket.on("game:your-block", (block) => {
  assignedBlock = block;
  myBlock.textContent = `${block.color} ${block.shape}`;
  statusText.textContent = "Your turn! Click an empty cell to place your block.";
});

socket.on("game:message", (message) => {
  statusText.textContent = message;
});

createBoard();

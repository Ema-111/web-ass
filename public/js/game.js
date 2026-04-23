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
let myId = "";
let myTurn = false;
let assignedBlock = null;
let timerId = null;

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
  socket.emit("game:place", { row, col });
}

function updateTimer(expiresAt) {
  if (timerId) clearInterval(timerId);
  if (!expiresAt) {
    timerText.textContent = "-";
    return;
  }

  const tick = () => {
    const remain = Math.max(0, expiresAt - Date.now());
    timerText.textContent = `${Math.ceil(remain / 1000)}s`;
  };
  tick();
  timerId = setInterval(tick, 500);
}

function renderState(state) {
  const cells = boardEl.querySelectorAll(".cell");
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const idx = r * BOARD_SIZE + c;
      cells[idx].innerHTML = renderShape(state.board[r][c]);
    }
  }

  playerList.innerHTML = "";
  state.players.forEach((player) => {
    const li = document.createElement("li");
    const me = player.id === myId ? " (You)" : "";
    const current = player.id === state.currentPlayerId ? " <- Turn" : "";
    li.textContent = `${player.name}${me}: ${player.score}${current}`;
    playerList.appendChild(li);
  });

  turnName.textContent = state.currentPlayerName || "-";
  poolSize.textContent = String(state.poolSize);
  myTurn = state.currentPlayerId === myId;
  if (!myTurn) {
    assignedBlock = null;
    myBlock.textContent = "None";
  }
  updateTimer(state.turnExpiresAt);
}

joinBtn.addEventListener("click", () => {
  socket.emit("game:join", nameInput.value.trim());
});

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("game:state", renderState);

socket.on("game:your-block", (block) => {
  assignedBlock = block;
  myBlock.textContent = `${block.color} ${block.shape}`;
});

socket.on("game:message", (message) => {
  statusText.textContent = message;
});

createBoard();

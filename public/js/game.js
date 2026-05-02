const socket = io();

const boardEl = document.getElementById("board");
const joinBtn = document.getElementById("join-btn");
const nameInput = document.getElementById("name-input");
const statusText = document.getElementById("status-text");
statusText.classList.add("status-badge");
const playerList = document.getElementById("player-list");
const turnName = document.getElementById("turn-name");
const poolSize = document.getElementById("pool-size");
const myBlock = document.getElementById("my-block");
const timerText = document.getElementById("timer-text");
const boardStatusText = document.getElementById("board-status-text");

const BOARD_SIZE = 4;
const BOARD_HINT_DURATION_MS = 3200;
const CLEAR_ANIMATION_MS = 420;

let boardHintTimer = null;

function showBoardHint(message, isActive = false) {
  if (!boardStatusText || !message) return;

  boardStatusText.textContent = message;
  boardStatusText.classList.toggle("is-your-turn", isActive);
  boardStatusText.classList.add("is-visible");

  if (boardHintTimer) {
    clearTimeout(boardHintTimer);
  }

  boardHintTimer = setTimeout(() => {
    boardStatusText.classList.remove("is-visible", "is-your-turn");
    boardHintTimer = null;
  }, BOARD_HINT_DURATION_MS);
}

let myId = socket.id || "";
let myTurn = false;
let isJoinedGame = false;
let assignedBlock = null;
let timerId = null;
let lastMyScore = 0;
let scoreToastUntil = 0;

let localBoard = Array.from({ length: BOARD_SIZE }, () =>
  Array(BOARD_SIZE).fill(null)
);
let lastBoardSnapshot = Array.from({ length: BOARD_SIZE }, () =>
  Array(BOARD_SIZE).fill(null)
);

function getBlockColor(color) {
  const colorMap = {
    rose: "#ff6ba5",
    lavender: "#b890ff",
    mint: "#6dd9b8",
    sky: "#6cbdff"
  };
  return colorMap[color] || "#9d80c4";
}

function renderShape(block) {
  if (!block) return "";
  const blockColor = getBlockColor(block.color);
  return `<span class="shape ${block.shape} ${block.color}" style="--block-color: ${blockColor};"></span>`;
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function renderMyBlockPreview(block) {
  if (!myBlock) return;
  if (!block) {
    myBlock.innerHTML = '<span class="block-content">None</span>';
    return;
  }

  myBlock.innerHTML = `
    <span class="my-block-preview-inner">
      ${renderShape(block)}
      <span class="block-content">${block.color} ${block.shape}</span>
    </span>
  `;
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
  if (!isJoinedGame) {
    statusText.classList.remove("is-your-turn");
    statusText.textContent = "Please join the game first.";
    showBoardHint("Please join the game first.");
    return;
  }

  if (!myTurn) {
    statusText.classList.remove("is-your-turn");
    statusText.textContent = "Not your turn now.";
    showBoardHint("Not your turn now.");
    return;
  }
  if (!assignedBlock) {
    statusText.classList.remove("is-your-turn");
    statusText.textContent = "Waiting for your random block...";
    showBoardHint("Waiting for your random block...");
    return;
  }

  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);

  if (localBoard[row][col]) {
    statusText.classList.remove("is-your-turn");
    statusText.textContent = "That cell is already occupied. Pick another.";
    showBoardHint("That cell is already occupied. Pick another.");
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
  const prevBoard = cloneBoard(lastBoardSnapshot);
  localBoard = state.board.map((row) => [...row]);

  const cells = boardEl.querySelectorAll(".cell");
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const idx = r * BOARD_SIZE + c;
      const cell = cells[idx];
      const blockData = state.board[r][c];
      const prevBlockData = prevBoard[r][c];

      if (prevBlockData && !blockData) {
        cell.innerHTML = renderShape(prevBlockData);
        const clearingShape = cell.querySelector(".shape");
        if (clearingShape) clearingShape.classList.add("is-clearing");
        cell.classList.add("is-clearing-cell");

        setTimeout(() => {
          if (localBoard[r][c] === null) {
            cell.innerHTML = "";
            cell.classList.remove("is-clearing-cell");
          }
        }, CLEAR_ANIMATION_MS);
      } else {
        cell.innerHTML = renderShape(blockData);
        cell.classList.remove("is-clearing-cell");
      }

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
    const isMe = player.id === myId;
    const isCurrent = player.id === state.currentPlayerId;

    li.classList.add("player-row");
    if (isMe) li.classList.add("is-me");
    if (isCurrent) li.classList.add("is-current-turn");

    const turnChip = isCurrent
      ? `<span class="player-turn-chip">${isMe ? "Your Turn" : "Current Turn"}</span>`
      : "";

    li.innerHTML = `
      <div class="player-main">
        <span class="player-name">${player.name}${isMe ? " (You)" : ""}</span>
        <span class="player-score-badge" aria-label="score ${player.score}">
          <span class="player-score-label">Score</span>
          <strong class="player-score-value">${player.score}</strong>
        </span>
      </div>
      ${turnChip}
    `;

    playerList.appendChild(li);
  });

  turnName.textContent = state.currentPlayerName || "-";
  poolSize.textContent = String(state.poolSize);

  const wasMyTurn = myTurn;
  myTurn = state.currentPlayerId === myId;
  isJoinedGame = state.players.some((player) => player.id === myId);

  const me = state.players.find((player) => player.id === myId);
  const currentMyScore = me ? me.score : 0;

  if (isJoinedGame && currentMyScore > lastMyScore) {
    const earned = currentMyScore - lastMyScore;
    const pointsText = earned === 1 ? "point" : "points";
    const congrats = `Congratulations! You earned ${earned} ${pointsText}.`;
    scoreToastUntil = Date.now() + 1800;
    statusText.classList.add("is-your-turn");
    statusText.textContent = congrats;
    showBoardHint(congrats, true);
  } else if (Date.now() >= scoreToastUntil) {
    statusText.classList.toggle("is-your-turn", myTurn);
  }

  lastMyScore = currentMyScore;

  if (wasMyTurn && !myTurn) {
    assignedBlock = null;
    renderMyBlockPreview(null);
  }

  updateTimer(state.turnExpiresAt);
  lastBoardSnapshot = cloneBoard(state.board);
}

socket.on("connect", () => {
  myId = socket.id;
  isJoinedGame = false;
  lastMyScore = 0;
  scoreToastUntil = 0;
  showBoardHint("Connected. Please enter your name.");
});

socket.on("disconnect", () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  timerText.textContent = "-";
  statusText.classList.remove("is-your-turn");
  statusText.textContent = "Disconnected from server.";
  showBoardHint("Disconnected from server.");
});

joinBtn.addEventListener("click", () => {
  if (isJoinedGame) {
    statusText.classList.remove("is-your-turn");
    statusText.textContent = "You have already joined the game.";
    showBoardHint("You have already joined the game.");
    return;
  }

  const name = nameInput.value.trim();
  if (!name) {
    statusText.classList.remove("is-your-turn");
    statusText.textContent = "Please enter a name first.";
    showBoardHint("Please enter a name first.");
    return;
  }

  socket.emit("game:join", name);
  showBoardHint("Joining game...");
});

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

socket.on("game:state", renderState);

socket.on("game:your-block", (block) => {
  assignedBlock = block;
  renderMyBlockPreview(block);
  statusText.classList.add("is-your-turn");
  statusText.textContent = "Your turn! Click an empty cell to place your block.";
  showBoardHint("Your turn! Click an empty cell to place your block.", true);
});

socket.on("game:message", (message) => {
  if (Date.now() < scoreToastUntil) return;
  const isActive = message.includes("Your turn");
  statusText.classList.toggle("is-your-turn", isActive);
  statusText.textContent = message;
  showBoardHint(message, isActive);
});

renderMyBlockPreview(null);
createBoard();

// ============= STATE =============
let socket = null;
let currentMode = null; // 'bot', 'local', 'online'
let botDifficulty = null; // 'easy', 'medium', 'hard'

let board = Array(9).fill(null);
let currentTurn = 'X'; // 'X' or 'O'
let isGameActive = false;
let mySymbol = 'X'; // For online/bot: which symbol is the player
let onlineRoomCode = null;

let startingTurn = 'X';
let scores = { X: 0, draw: 0, O: 0 };

// ============= DOM ELEMENTS =============
// Views
const views = {
  dashboard: document.getElementById('view-dashboard'),
  difficulty: document.getElementById('view-difficulty'),
  lobby: document.getElementById('view-lobby'),
  waiting: document.getElementById('view-waiting'),
  game: document.getElementById('view-game')
};

// Buttons and Inputs
const btnBot = document.getElementById('btn-play-bot');
const btnLocal = document.getElementById('btn-play-local');
const btnOnline = document.getElementById('btn-play-online');

const btnEasy = document.getElementById('btn-easy');
const btnMedium = document.getElementById('btn-medium');
const btnHard = document.getElementById('btn-hard');

const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnCancelWait = document.getElementById('btn-cancel-wait');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnRematch = document.getElementById('btn-rematch');
const btnHome = document.getElementById('btn-home');

const inputCreateName = document.getElementById('input-name-create');
const inputJoinName = document.getElementById('input-name-join');
const inputRoomCode = document.getElementById('input-room-code');

const cells = document.querySelectorAll('.cell');
const turnText = document.getElementById('turn-text');
const gameResult = document.getElementById('game-result');
const resultText = document.getElementById('result-text');

const playerXInd = document.getElementById('player-x');
const playerOInd = document.getElementById('player-o');
const nameX = document.getElementById('name-x');
const nameO = document.getElementById('name-o');

const scoreXEl = document.getElementById('score-x');
const scoreDrawEl = document.getElementById('score-draw');
const scoreOEl = document.getElementById('score-o');

// ============= UTILS =============
function switchView(viewName) {
  Object.values(views).forEach(view => view.classList.remove('active'));
  views[viewName].classList.add('active');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Back Buttons
document.getElementById('btn-back-diff').addEventListener('click', () => switchView('dashboard'));
document.getElementById('btn-back-lobby').addEventListener('click', () => switchView('dashboard'));
document.getElementById('btn-back-game').addEventListener('click', () => {
  if (currentMode === 'online' && socket) {
    socket.disconnect();
    socket = null;
  }
  switchView('dashboard');
});

// ============= DASHBOARD LOGIC =============
btnBot.addEventListener('click', () => {
  currentMode = 'bot';
  switchView('difficulty');
});

btnLocal.addEventListener('click', () => {
  currentMode = 'local';
  startLocalGame();
});

btnOnline.addEventListener('click', () => {
  currentMode = 'online';
  initSocket();
  switchView('lobby');
});

// ============= BOT LOGIC =============
btnEasy.addEventListener('click', () => startBotGame('easy'));
btnMedium.addEventListener('click', () => startBotGame('medium'));
btnHard.addEventListener('click', () => startBotGame('hard'));

function startBotGame(diff) {
  botDifficulty = diff;
  mySymbol = 'X';
  nameX.innerText = 'You';
  nameO.innerText = 'Bot';
  resetGameUI();
  switchView('game');
}

function botMakeMove() {
  if (!isGameActive || currentTurn === mySymbol) return;
  
  let move = -1;
  if (botDifficulty === 'easy') {
    move = getRandomMove();
  } else if (botDifficulty === 'medium') {
    // 50% random, 50% best move
    move = Math.random() > 0.5 ? getBestMove() : getRandomMove();
  } else {
    move = getBestMove();
  }

  if (move !== -1) {
    // Small delay to simulate thinking
    setTimeout(() => {
      handleCellClick(move, true);
    }, 500);
  }
}

function getRandomMove() {
  const emptyCells = board.map((cell, i) => cell === null ? i : null).filter(i => i !== null);
  if (emptyCells.length === 0) return -1;
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function getBestMove() {
  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O'; // Bot is always O in this setup
      let score = minimax(board, 0, false);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

const winLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinnerMinimax(b) {
  for (let [x, y, z] of winLines) {
    if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
  }
  if (b.every(cell => cell !== null)) return 'draw';
  return null;
}

function minimax(b, depth, isMaximizing) {
  let result = checkWinnerMinimax(b);
  if (result === 'O') return 10 - depth;
  if (result === 'X') return depth - 10;
  if (result === 'draw') return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = 'O';
        let score = minimax(b, depth + 1, false);
        b[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = 'X';
        let score = minimax(b, depth + 1, true);
        b[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

// ============= LOCAL LOGIC =============
function startLocalGame() {
  nameX.innerText = 'Player 1';
  nameO.innerText = 'Player 2';
  resetGameUI();
  switchView('game');
}

// ============= ONLINE LOGIC =============
function initSocket() {
  if (!socket) {
    socket = io();
    setupSocketHandlers();
  }
}

function setupSocketHandlers() {
  socket.on('room-created', ({ roomCode, symbol }) => {
    onlineRoomCode = roomCode;
    mySymbol = symbol;
    document.getElementById('display-room-code').innerText = roomCode;
    switchView('waiting');
  });

  socket.on('room-joined', ({ roomCode, symbol }) => {
    onlineRoomCode = roomCode;
    mySymbol = symbol;
    document.getElementById('join-error').innerText = '';
  });

  socket.on('join-error', (msg) => {
    document.getElementById('join-error').innerText = msg;
  });

  socket.on('game-start', (state) => {
    state.players.forEach(p => {
      if (p.symbol === 'X') nameX.innerText = p.name;
      if (p.symbol === 'O') nameO.innerText = p.name;
    });
    if (!state.isRematch) {
      scores = { X: 0, draw: 0, O: 0 }; // Reset scores only for new matchup
    }
    updateScoreUI();
    
    board = state.board;
    currentTurn = state.currentTurn;
    isGameActive = true;
    updateBoardUI();
    updateTurnUI();
    gameResult.classList.remove('active');
    cells.forEach(c => c.disabled = false);
    switchView('game');
  });

  socket.on('move-made', ({ board: newBoard, currentTurn: newTurn, result }) => {
    board = newBoard;
    currentTurn = newTurn;
    updateBoardUI();
    
    if (result) {
      isGameActive = false;
      handleWin(result.winner, result.line);
    } else {
      updateTurnUI();
    }
  });

  socket.on('rematch-requested', () => {
    showToast('Opponent wants a rematch!');
  });

  socket.on('opponent-left', () => {
    showToast('Opponent left the room');
    isGameActive = false;
    setTimeout(() => {
      socket.disconnect();
      socket = null;
      switchView('dashboard');
    }, 2000);
  });
}

btnCreateRoom.addEventListener('click', () => {
  const name = inputCreateName.value.trim() || 'Player 1';
  socket.emit('create-room', name);
});

btnJoinRoom.addEventListener('click', () => {
  const name = inputJoinName.value.trim() || 'Player 2';
  const code = inputRoomCode.value.trim();
  if (code.length < 1) {
    document.getElementById('join-error').innerText = 'Please enter a code';
    return;
  }
  socket.emit('join-room', { roomCode: code, playerName: name });
});

btnCancelWait.addEventListener('click', () => {
  socket.disconnect();
  socket = null;
  switchView('lobby');
});

btnCopyCode.addEventListener('click', () => {
  const code = document.getElementById('display-room-code').innerText;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Code copied!');
  });
});

// ============= GAME ENGINE =============
function handleCellClick(index, isBot = false) {
  if (!isGameActive || board[index] !== null) return;
  
  // Enforce turn in bot or online modes
  if (currentMode === 'online') {
    if (currentTurn !== mySymbol) {
      showToast("Not your turn!");
      return;
    }
    socket.emit('make-move', { roomCode: onlineRoomCode, index });
    return; // Wait for server to confirm move via 'move-made'
  }

  if (currentMode === 'bot' && !isBot && currentTurn !== mySymbol) return;

  // Local & Bot logic (optimistic update)
  board[index] = currentTurn;
  updateBoardUI();

  const winnerInfo = getLocalWin(board);
  if (winnerInfo) {
    isGameActive = false;
    handleWin(winnerInfo.winner, winnerInfo.line);
    return;
  }

  currentTurn = currentTurn === 'X' ? 'O' : 'X';
  updateTurnUI();

  if (currentMode === 'bot' && currentTurn !== mySymbol) {
    botMakeMove();
  }
}

function getLocalWin(b) {
  for (let [x, y, z] of winLines) {
    if (b[x] && b[x] === b[y] && b[x] === b[z]) return { winner: b[x], line: [x, y, z] };
  }
  if (b.every(cell => cell !== null)) return { winner: 'draw', line: null };
  return null;
}

cells.forEach(cell => {
  cell.addEventListener('click', () => {
    handleCellClick(parseInt(cell.getAttribute('data-index')));
  });
});

// ============= UI UPDATES =============
function updateBoardUI() {
  cells.forEach((cell, i) => {
    cell.innerText = board[i] || '';
    cell.className = 'cell'; // reset
    if (board[i]) {
      cell.classList.add('filled', board[i].toLowerCase());
    }
  });
}

function updateTurnUI() {
  playerXInd.classList.remove('active');
  playerOInd.classList.remove('active');
  
  if (currentTurn === 'X') {
    playerXInd.classList.add('active');
    turnText.innerText = "X's Turn";
    turnText.style.color = 'var(--neon-cyan)';
    turnText.style.textShadow = 'var(--glow-cyan)';
  } else if (currentTurn === 'O') {
    playerOInd.classList.add('active');
    turnText.innerText = "O's Turn";
    turnText.style.color = 'var(--neon-magenta)';
    turnText.style.textShadow = 'var(--glow-magenta)';
  } else {
    turnText.innerText = "Game Over";
    turnText.style.color = 'var(--text-active)';
    turnText.style.textShadow = 'none';
  }

  if (currentMode === 'online') {
    if (currentTurn === mySymbol) {
      turnText.innerText = "Your Turn";
    } else {
      turnText.innerText = "Opponent's Turn";
    }
  } else if (currentMode === 'bot') {
    if (currentTurn === mySymbol) {
      turnText.innerText = "Your Turn";
    } else {
      turnText.innerText = "Bot is thinking...";
    }
  }
}

function handleWin(winner, line) {
  if (line) {
    line.forEach(i => cells[i].classList.add('win'));
  }
  
  scores[winner]++;
  updateScoreUI();

  if (winner === 'X') {
    resultText.innerText = `${nameX.innerText} Wins!`;
    resultText.className = 'result-text x-win';
  } else if (winner === 'O') {
    resultText.innerText = `${nameO.innerText} Wins!`;
    resultText.className = 'result-text o-win';
  } else {
    resultText.innerText = 'Draw!';
    resultText.className = 'result-text draw';
  }

  cells.forEach(c => c.disabled = true);
  gameResult.classList.add('active');
  turnText.innerText = "Game Over";
  turnText.style.color = 'inherit';
  turnText.style.textShadow = 'none';
}

function updateScoreUI() {
  scoreXEl.innerText = scores.X;
  scoreDrawEl.innerText = scores.draw;
  scoreOEl.innerText = scores.O;
}

function resetGameUI() {
  board = Array(9).fill(null);
  startingTurn = 'X';
  currentTurn = startingTurn;
  isGameActive = true;
  scores = { X: 0, draw: 0, O: 0 };
  updateScoreUI();
  updateBoardUI();
  updateTurnUI();
  gameResult.classList.remove('active');
  cells.forEach(c => c.disabled = false);
}

// ============= RESULT ACTIONS =============
btnRematch.addEventListener('click', () => {
  if (currentMode === 'online') {
    socket.emit('request-rematch', onlineRoomCode);
    btnRematch.innerText = 'Sent...';
    btnRematch.disabled = true;
    setTimeout(() => {
      btnRematch.innerText = 'Rematch';
      btnRematch.disabled = false;
    }, 3000); // Reset UI after 3s if no response
  } else {
    board = Array(9).fill(null);
    startingTurn = startingTurn === 'X' ? 'O' : 'X';
    currentTurn = startingTurn;
    isGameActive = true;
    
    updateBoardUI();
    updateTurnUI();
    gameResult.classList.remove('active');
    cells.forEach(c => c.disabled = false);

    if (currentMode === 'bot' && currentTurn !== mySymbol) {
      botMakeMove();
    }
  }
});

btnHome.addEventListener('click', () => {
  if (currentMode === 'online' && socket) {
    socket.disconnect();
    socket = null;
  }
  switchView('dashboard');
});

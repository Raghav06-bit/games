const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check for Render
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// ---------- Room Management ----------
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function checkWin(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  if (board.every(cell => cell !== null)) return { winner: 'draw', line: null };
  return null;
}

// ---------- Socket.IO Events ----------
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', (data) => {
    // Legacy support for XO string payload or new object payload
    const playerName = typeof data === 'string' ? data : data.playerName;
    const gameType = typeof data === 'string' ? 'xo' : data.gameType;
    const digitLength = typeof data === 'string' ? 6 : data.digitLength;

    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      gameType: gameType,
      digitLength: digitLength,
      players: [{ id: socket.id, name: playerName || 'Player 1', symbol: 'X' }],
      board: Array(9).fill(null),
      startingTurn: 'X',
      currentTurn: 'X',
      gameActive: false,
      rematchRequests: new Set(),
      // Number guessing specific state
      secretNumbers: {},
      readyPlayers: new Set()
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit('room-created', { roomCode, symbol: 'X', gameType, digitLength });
    console.log(`Room ${roomCode} created by ${playerName} for ${gameType}`);
  });

  // Join an existing room
  socket.on('join-room', ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('join-error', 'Room not found. Check the code and try again.');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('join-error', 'Room is full.');
      return;
    }

    room.players.push({ id: socket.id, name: playerName || 'Player 2', symbol: 'O' });
    room.gameActive = true;
    socket.join(code);
    socket.roomCode = code;

    socket.emit('room-joined', { roomCode: code, symbol: 'O', gameType: room.gameType, digitLength: room.digitLength });

    // Notify both players the game is starting
    io.to(code).emit('game-start', {
      players: room.players.map(p => ({ name: p.name, symbol: p.symbol, id: p.id })),
      board: room.board,
      currentTurn: room.currentTurn,
      gameType: room.gameType,
      digitLength: room.digitLength
    });

    console.log(`${playerName} joined room ${code}`);
  });

  // Handle a move (XO)
  socket.on('make-move', ({ roomCode, index }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.gameActive || room.gameType !== 'xo') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (player.symbol !== room.currentTurn) return;
    if (room.board[index] !== null) return;

    room.board[index] = player.symbol;
    const result = checkWin(room.board);

    if (result) {
      room.gameActive = false;
      io.to(roomCode).emit('move-made', {
        board: room.board,
        currentTurn: null,
        result: result
      });
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
      io.to(roomCode).emit('move-made', {
        board: room.board,
        currentTurn: room.currentTurn,
        result: null
      });
    }
  });

  // ---------- Number Guessing Specific Events ----------
  socket.on('setup-secret-number', ({ roomCode, number }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameType !== 'guess') return;

    room.secretNumbers[socket.id] = number;
    room.readyPlayers.add(socket.id);

    if (room.readyPlayers.size === 2) {
      room.gameActive = true;
      io.to(roomCode).emit('guess-start');
    } else {
      socket.to(roomCode).emit('opponent-ready');
    }
  });

  socket.on('make-num-guess', ({ roomCode, guess }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.gameActive || room.gameType !== 'guess') return;
    
    const opponent = room.players.find(p => p.id !== socket.id);
    if (!opponent) return;
    const opponentSecret = room.secretNumbers[opponent.id];
    if (!opponentSecret) return;

    if (guess === opponentSecret) {
      room.gameActive = false;
      io.to(roomCode).emit('guess-win', { winnerId: socket.id, number: opponentSecret });
    } else {
      const pGuess = parseInt(guess, 10);
      const pSecret = parseInt(opponentSecret, 10);
      const status = pGuess < pSecret ? 'HIGHER' : 'LOWER';
      
      socket.emit('guess-result', { guess, status, fromId: socket.id });
      socket.to(roomCode).emit('opponent-guessed', { guess, status, fromId: socket.id });
    }
  });


  // Rematch request
  socket.on('request-rematch', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.rematchRequests.add(socket.id);

    if (room.rematchRequests.size === 2) {
      // Both players want a rematch
      room.board = Array(9).fill(null);
      room.startingTurn = room.startingTurn === 'X' ? 'O' : 'X';
      room.currentTurn = room.startingTurn;
      room.secretNumbers = {};
      room.readyPlayers = new Set();
      room.rematchRequests.clear();

      if (room.gameType === 'xo') {
        room.gameActive = true;
      } else {
        // For guess game, they need to setup numbers again
        room.gameActive = false;
      }

      io.to(roomCode).emit('game-start', {
        players: room.players.map(p => ({ name: p.name, symbol: p.symbol, id: p.id })),
        board: room.board,
        currentTurn: room.currentTurn,
        gameType: room.gameType,
        digitLength: room.digitLength,
        isRematch: true
      });
    } else {
      // Notify opponent that rematch was requested
      socket.to(roomCode).emit('rematch-requested');
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    // Notify remaining player
    socket.to(roomCode).emit('opponent-left');

    // Clean up the room
    rooms.delete(roomCode);
    console.log(`Room ${roomCode} destroyed`);
  });
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 X O Game server running on http://localhost:${PORT}`);
});

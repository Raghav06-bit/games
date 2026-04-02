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
  socket.on('create-room', (playerName) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      players: [{ id: socket.id, name: playerName || 'Player 1', symbol: 'X' }],
      board: Array(9).fill(null),
      startingTurn: 'X',
      currentTurn: 'X',
      gameActive: false,
      rematchRequests: new Set()
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit('room-created', { roomCode, symbol: 'X' });
    console.log(`Room ${roomCode} created by ${playerName}`);
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

    socket.emit('room-joined', { roomCode: code, symbol: 'O' });

    // Notify both players the game is starting
    io.to(code).emit('game-start', {
      players: room.players.map(p => ({ name: p.name, symbol: p.symbol })),
      board: room.board,
      currentTurn: room.currentTurn
    });

    console.log(`${playerName} joined room ${code}`);
  });

  // Handle a move
  socket.on('make-move', ({ roomCode, index }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.gameActive) return;

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
      room.gameActive = true;
      room.rematchRequests.clear();

      io.to(roomCode).emit('game-start', {
        players: room.players.map(p => ({ name: p.name, symbol: p.symbol })),
        board: room.board,
        currentTurn: room.currentTurn
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

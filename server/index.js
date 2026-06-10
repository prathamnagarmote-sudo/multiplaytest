import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Matchmaker } from './Matchmaker.js';
import { GameEngine } from './GameEngine.js';
import { USERS } from './users.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const gameEngine = new GameEngine(io);
const matchmaker = new Matchmaker(io, gameEngine);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Fetch available profiles for local testing
  socket.on('get_profiles', () => {
    socket.emit('profiles_list', USERS);
  });

  // Handle mock login validation
  socket.on('login', (data) => {
    const user = USERS.find((u) => u.userId === data?.userId);
    if (user) {
      socket.user = user;
      console.log(`Socket ${socket.id} logged in as ${user.userName}`);
      socket.emit('login_success', user);
    } else {
      socket.emit('login_error', { message: 'Invalid User ID' });
    }
  });

  // Rejoin room event
  socket.on('rejoin_room', (data) => {
    socket.join(data.roomId);
    gameEngine.handleRejoin(data.userId, data.roomId, socket);
  });

  // Matchmaking events
  socket.on('join_matchmaking', (data) => {
    socket.playerName = data?.name || (socket.user ? socket.user.userName : 'Anonymous');
    socket.avatarUrl = data?.avatarUrl || (socket.user ? socket.user.avatar_url : '');
    socket.userLevel = data?.level || (socket.user ? socket.user.user_level : 1);
    socket.userId = data?.userId || (socket.user ? socket.user.userId : `anon_${socket.id}`);
    
    // Support 2-player and 4-player queues
    const matchSize = data?.matchSize === 2 ? 2 : 4;
    socket.matchSize = matchSize;
    socket.preferredColor = data?.preferredColor || 'blue';

    console.log(`Socket ${socket.id} (user: ${socket.userId}) joining matchmaking for ${matchSize}-player match. Name: ${socket.playerName}, Level: ${socket.userLevel}, Preferred Color: ${socket.preferredColor}`);
    matchmaker.addPlayer(socket);
  });

  socket.on('leave_matchmaking', () => {
    matchmaker.removePlayer(socket);
  });

  // Game events
  socket.on('request_roll', (data) => {
    gameEngine.handleRoll(socket.id, data.roomId);
  });

  socket.on('submit_move', (data) => {
    gameEngine.handleMove(socket.id, data.roomId, data.tokenId, data.isUnlock);
  });

  socket.on('finish_turn', (data) => {
    gameEngine.handleFinishTurn(socket.id, data.roomId, data.nextTurnColour);
  });

  socket.on('exit_match', (data) => {
    gameEngine.handleExitMatch(socket.id, data?.roomId);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    matchmaker.removePlayer(socket);
    gameEngine.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

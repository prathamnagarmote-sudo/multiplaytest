export class GameEngine {
  constructor(io) {
    this.io = io;
    this.games = new Map(); // roomId -> gameState
    this.disconnectTimeouts = new Map(); // userId -> timeoutId
  }

  startMatch(roomId, players) {
    const initialState = {
      roomId,
      players,
      currentTurnIndex: 0,
      diceValue: null,
      status: 'playing',
    };
    
    this.games.set(roomId, initialState);
    
    // Notify players the game is starting
    this.io.to(roomId).emit('match_started', initialState);
    this.processTurn(roomId);
  }

  processTurn(roomId) {
    const game = this.games.get(roomId);
    if (!game) return;

    const currentPlayer = game.players[game.currentTurnIndex];
    this.io.to(roomId).emit('turn_update', {
      currentTurnIndex: game.currentTurnIndex,
      currentPlayerId: currentPlayer.id,
      currentPlayerColour: currentPlayer.color
    });

    if (currentPlayer.isBot) {
      // Bot logic
      setTimeout(() => {
        this.executeRoll(roomId, currentPlayer.id);
      }, 1500); // Wait 1.5 seconds so it feels human
    }
  }

  handleRoll(socketId, roomId) {
    const game = this.games.get(roomId);
    if (!game) return;

    const currentPlayer = game.players[game.currentTurnIndex];
    if (currentPlayer.id !== socketId && !currentPlayer.isBot) {
      console.log(`Player ${socketId} tried to roll out of turn!`);
      return;
    }

    this.executeRoll(roomId, currentPlayer.id);
  }

  executeRoll(roomId, playerId) {
    const game = this.games.get(roomId);
    if (!game) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    game.diceValue = roll;
    
    const player = game.players.find(p => p.id === playerId);
    
    this.io.to(roomId).emit('dice_rolled', { 
      playerId, 
      playerUserId: player ? player.userId : undefined, 
      roll 
    });
  }

  handleMove(socketId, roomId, tokenId, isUnlock) {
    const game = this.games.get(roomId);
    if (!game) return;

    const currentPlayer = game.players[game.currentTurnIndex];
    this.io.to(roomId).emit('token_moved', {
      colour: currentPlayer.color,
      id: tokenId,
      isUnlock
    });
  }

  handleFinishTurn(socketId, roomId, nextTurnColour) {
    const game = this.games.get(roomId);
    if (!game) return;

    const nextIndex = game.players.findIndex(p => p.color === nextTurnColour);
    if (nextIndex !== -1) {
      game.currentTurnIndex = nextIndex;
      this.processTurn(roomId);
    }
  }

  handleRejoin(userId, roomId, socket) {
    const game = this.games.get(roomId);
    if (!game) return;

    const player = game.players.find(p => p.userId === userId);
    if (player) {
      // Clear any pending bot takeover timeout
      if (this.disconnectTimeouts.has(userId)) {
        clearTimeout(this.disconnectTimeouts.get(userId));
        this.disconnectTimeouts.delete(userId);
        console.log(`Cleared bot-takeover timeout for player ${userId} rejoining room ${roomId}`);
      }

      const oldSocketId = player.id;
      player.id = socket.id;
      player.isBot = false;
      
      if (player.name.includes(' (Bot)')) {
        player.name = player.name.replace(' (Bot)', '');
      }

      console.log(`Updated player ${userId} socket mapping: ${oldSocketId} -> ${socket.id}`);
      
      // Update turn details for synced view (delayed to ensure client listeners are bound)
      setTimeout(() => {
        const gameInstance = this.games.get(roomId);
        if (!gameInstance) return;
        const currentPlayer = gameInstance.players[gameInstance.currentTurnIndex];
        socket.emit('turn_update', {
          currentTurnIndex: gameInstance.currentTurnIndex,
          currentPlayerId: currentPlayer.id,
          currentPlayerColour: currentPlayer.color
        });
      }, 150);
    }
  }

  handleExitMatch(socketId, roomId) {
    const game = this.games.get(roomId);
    if (!game) return;

    const playerIndex = game.players.findIndex(p => p.id === socketId);
    if (playerIndex !== -1) {
      const player = game.players[playerIndex];
      // For 2-player matches, exiting immediately forfeits the match
      if (game.players.length === 2) {
        const opponent = game.players.find(p => p.id !== socketId);
        if (opponent) {
          console.log(`Forfeit match ${roomId}: Player ${player.userId} exited. Player ${opponent.userId} wins.`);
          this.io.to(roomId).emit('match_forfeited', { winnerColor: opponent.color, loserColor: player.color });
          this.games.delete(roomId);
          return;
        }
      }

      // For 4-player matches, convert player to Bot immediately on manual exit
      player.isBot = true;
      if (!player.name.includes(' (Bot)')) {
        player.name += ' (Bot)';
      }
      this.io.to(roomId).emit('player_disconnected', {
        colour: player.color,
        playerId: player.id,
        userId: player.userId
      });
      if (game.currentTurnIndex === playerIndex) {
        this.processTurn(roomId);
      }
    }
  }

  handleDisconnect(socketId) {
    for (const [roomId, game] of this.games.entries()) {
      const playerIndex = game.players.findIndex(p => p.id === socketId);
      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        if (player.isBot) continue;

        console.log(`Player ${player.userId} disconnected from match ${roomId}. Takeover/Forfeit scheduled in 4s.`);
        
        const timeoutId = setTimeout(() => {
          const gameInstance = this.games.get(roomId);
          if (!gameInstance) return;

          // In 2-player matches, disconnect results in forfeit win for the opponent
          if (gameInstance.players.length === 2) {
            const opponent = gameInstance.players.find(p => p.id !== socketId);
            if (opponent) {
              console.log(`Forfeit match ${roomId}: Player ${player.userId} disconnected timeout. Player ${opponent.userId} wins.`);
              this.io.to(roomId).emit('match_forfeited', { winnerColor: opponent.color, loserColor: player.color });
              this.games.delete(roomId);
              return;
            }
          }

          player.isBot = true;
          if (!player.name.includes(' (Bot)')) {
            player.name += ' (Bot)';
          }
          
          this.io.to(roomId).emit('player_disconnected', { 
            colour: player.color,
            playerId: player.id,
            userId: player.userId
          });

          console.log(`Bot successfully took over player ${player.userId} in room ${roomId}`);

          if (gameInstance.currentTurnIndex === playerIndex) {
            this.processTurn(roomId);
          }
          
          this.disconnectTimeouts.delete(player.userId);
        }, 4000);

        this.disconnectTimeouts.set(player.userId, timeoutId);
      }
    }
  }
}

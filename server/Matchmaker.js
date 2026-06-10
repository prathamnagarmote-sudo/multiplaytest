const REALISTIC_BOTS = [
  { name: 'ApexPhantom', avatarUrl: 'https://i.pravatar.cc/150?img=11', level: 3 },
  { name: 'GamerValkyrie', avatarUrl: 'https://i.pravatar.cc/150?img=12', level: 2 },
  { name: 'NexusVortex', avatarUrl: 'https://i.pravatar.cc/150?img=13', level: 4 },
  { name: 'FrostBite', avatarUrl: 'https://i.pravatar.cc/150?img=14', level: 1 },
  { name: 'SilentDagger', avatarUrl: 'https://i.pravatar.cc/150?img=15', level: 5 },
  { name: 'QuantumByte', avatarUrl: 'https://i.pravatar.cc/150?img=16', level: 3 },
  { name: 'ShadowEclipse', avatarUrl: 'https://i.pravatar.cc/150?img=17', level: 2 },
  { name: 'EmberPhoenix', avatarUrl: 'https://i.pravatar.cc/150?img=18', level: 4 },
  { name: 'AlphaRaptor', avatarUrl: 'https://i.pravatar.cc/150?img=19', level: 1 },
  { name: 'StarDust', avatarUrl: 'https://i.pravatar.cc/150?img=20', level: 5 },
  { name: 'NeonSpecter', avatarUrl: 'https://i.pravatar.cc/150?img=21', level: 3 },
  { name: 'HyperDrive', avatarUrl: 'https://i.pravatar.cc/150?img=22', level: 4 },
  { name: 'ZenithFocus', avatarUrl: 'https://i.pravatar.cc/150?img=23', level: 2 },
  { name: 'ChronoTrigger', avatarUrl: 'https://i.pravatar.cc/150?img=24', level: 5 },
  { name: 'WildViper', avatarUrl: 'https://i.pravatar.cc/150?img=25', level: 1 }
];

export class Matchmaker {
  constructor(io, gameEngine) {
    this.io = io;
    this.gameEngine = gameEngine;
    
    // Separate queues for 2-player and 4-player matchmaking
    this.queue2 = [];
    this.queue4 = [];
    
    // Separate timers and countdowns
    this.timer2 = null;
    this.timer4 = null;
    this.countdown2 = 30;
    this.countdown4 = 30;
  }

  addPlayer(socket) {
    // Prevent the same user from being in the queue multiple times
    this.removePlayer(socket, true);

    const size = socket.matchSize === 2 ? 2 : 4;
    const queue = size === 2 ? this.queue2 : this.queue4;
    
    queue.push(socket);
    console.log(`Player ${socket.id} (user: ${socket.userId}) joined ${size}-player matchmaking. Queue size: ${queue.length}`);
    
    if (queue.length === 1) {
      this.startTimer(size);
    }
    
    this.notifyQueueUpdate(size);

    if (queue.length === size) {
      this.createMatch(size);
    }
  }

  removePlayer(socket, silent = false) {
    const isAnon = !socket.userId || socket.userId.startsWith('anon_');

    const existingIn2 = this.queue2.filter(p => p.id === socket.id || (!isAnon && p.userId === socket.userId));
    if (existingIn2.length > 0) {
      this.queue2 = this.queue2.filter(p => !existingIn2.includes(p));
      existingIn2.forEach(p => {
        p.leave('matchmaking_2');
        if (p.id !== socket.id) {
          p.emit('matchmaking_kicked', { reason: 'Logged in from another session. Matchmaking cancelled.' });
        }
      });
      if (!silent) console.log(`Player ${socket.id} left 2-player matchmaking. Queue size: ${this.queue2.length}`);
      this.notifyQueueUpdate(2);
      if (this.queue2.length === 0 && this.timer2) {
        clearInterval(this.timer2);
        this.timer2 = null;
      }
    }
    
    const existingIn4 = this.queue4.filter(p => p.id === socket.id || (!isAnon && p.userId === socket.userId));
    if (existingIn4.length > 0) {
      this.queue4 = this.queue4.filter(p => !existingIn4.includes(p));
      existingIn4.forEach(p => {
        p.leave('matchmaking_4');
        if (p.id !== socket.id) {
          p.emit('matchmaking_kicked', { reason: 'Logged in from another session. Matchmaking cancelled.' });
        }
      });
      if (!silent) console.log(`Player ${socket.id} left 4-player matchmaking. Queue size: ${this.queue4.length}`);
      this.notifyQueueUpdate(4);
      if (this.queue4.length === 0 && this.timer4) {
        clearInterval(this.timer4);
        this.timer4 = null;
      }
    }
  }

  startTimer(size) {
    if (size === 2) {
      this.countdown2 = 30;
      if (this.timer2) clearInterval(this.timer2);
      
      this.timer2 = setInterval(() => {
        this.countdown2--;
        this.emitToQueue(2, 'timer_update', { timeRemaining: this.countdown2 });
        
        // Trigger bot assignment and start match when only 5 seconds are left and match is not full
        if (this.countdown2 <= 5) {
          clearInterval(this.timer2);
          this.timer2 = null;
          if (this.queue2.length > 0) {
            this.createMatch(2);
          }
        }
      }, 1000);
    } else {
      this.countdown4 = 30;
      if (this.timer4) clearInterval(this.timer4);
      
      this.timer4 = setInterval(() => {
        this.countdown4--;
        this.emitToQueue(4, 'timer_update', { timeRemaining: this.countdown4 });
        
        // Trigger bot assignment and start match when only 5 seconds are left and match is not full
        if (this.countdown4 <= 5) {
          clearInterval(this.timer4);
          this.timer4 = null;
          if (this.queue4.length > 0) {
            this.createMatch(4);
          }
        }
      }, 1000);
    }
  }

  emitToQueue(size, event, data) {
    const queue = size === 2 ? this.queue2 : this.queue4;
    queue.forEach(socket => {
      socket.emit(event, data);
    });
  }

  notifyQueueUpdate(size) {
    const queue = size === 2 ? this.queue2 : this.queue4;
    const playerList = queue.map(p => ({
      id: p.id,
      name: p.playerName || 'Anonymous',
      avatarUrl: p.avatarUrl || '',
      level: p.userLevel || 1
    }));
    
    queue.forEach(socket => {
      socket.join(`matchmaking_${size}`);
      socket.emit('queue_update', { 
        players: queue.length, 
        max: size,
        playerList
      });
    });
  }

  createMatch(size) {
    const roomId = `room_${Date.now()}`;
    const queue = size === 2 ? this.queue2 : this.queue4;
    
    if (size === 2 && this.timer2) {
      clearInterval(this.timer2);
      this.timer2 = null;
    } else if (size === 4 && this.timer4) {
      clearInterval(this.timer4);
      this.timer4 = null;
    }

    const matchPlayers = [];

    // Move real players
    while (queue.length > 0 && matchPlayers.length < size) {
      const p = queue.shift();
      p.leave(`matchmaking_${size}`);
      p.join(roomId);
      matchPlayers.push({
        id: p.id,
        userId: p.userId,
        isBot: false,
        name: p.playerName || `Player ${matchPlayers.length + 1}`,
        avatarUrl: p.avatarUrl || '',
        level: p.userLevel || 1,
        preferredColor: p.preferredColor || 'blue'
      });
    }

    let colors = ['blue', 'red', 'green', 'yellow'];
    if (size === 2) {
      const p1Preferred = matchPlayers[0] ? matchPlayers[0].preferredColor : 'blue';
      if (p1Preferred === 'red' || p1Preferred === 'yellow') {
        colors = ['red', 'yellow'];
      } else {
        colors = ['blue', 'green'];
      }
    }

    // Pick unique bots from list
    const shuffledBots = [...REALISTIC_BOTS].sort(() => Math.random() - 0.5);
    let botIndex = 0;

    // Inject bots
    while (matchPlayers.length < size) {
      const botProfile = shuffledBots[botIndex % shuffledBots.length];
      botIndex++;

      matchPlayers.push({
        id: `bot_${Math.random().toString(36).substring(7)}`,
        isBot: true,
        name: botProfile.name,
        avatarUrl: botProfile.avatarUrl,
        level: botProfile.level,
        preferredColor: null
      });
    }

    // Resolve color assignment
    const availableColors = [...colors];
    const assignedColors = new Map(); // matchPlayer index -> assigned color

    // First pass: Assign preferred colors if available
    for (let i = 0; i < matchPlayers.length; i++) {
      const p = matchPlayers[i];
      if (p.preferredColor && availableColors.includes(p.preferredColor)) {
        assignedColors.set(i, p.preferredColor);
        const idx = availableColors.indexOf(p.preferredColor);
        availableColors.splice(idx, 1);
      }
    }

    // Second pass: Assign remaining colors to players/bots without assignments
    for (let i = 0; i < matchPlayers.length; i++) {
      if (!assignedColors.has(i)) {
        const color = availableColors.shift();
        assignedColors.set(i, color);
      }
    }

    const finalPlayers = matchPlayers.map((p, idx) => ({
      id: p.id,
      userId: p.userId,
      isBot: p.isBot,
      color: assignedColors.get(idx),
      name: p.name,
      avatarUrl: p.avatarUrl,
      level: p.level
    }));

    console.log(`Creating ${size}-player match ${roomId} with ${finalPlayers.length} players (${finalPlayers.filter(p=>p.isBot).length} bots)`);
    this.gameEngine.startMatch(roomId, finalPlayers);
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

interface GameBet {
  gameId: string;
  userId: string;
  amount: number;
  timestamp: number;
}

interface LiveGameStats {
  gameId: string;
  concurrentPlayers: number;
  totalWagered: number;
  recentWins: Array<{
    userId: string;
    amount: number;
    game: string;
  }>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [],
    credentials: true,
  },
  namespace: 'games',
})
@UseGuards(WsJwtGuard)
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private activeConnections = new Map<string, Socket>();
  private gameRooms = new Map<string, Set<string>>();
  private liveStats = new Map<string, LiveGameStats>();

  async handleConnection(client: Socket) {
    try {
      const user = (client as any).user;
      if (!user) {
        client.disconnect();
        return;
      }

      this.activeConnections.set(user.id, client);
      this.logger.log(`Client connected: ${user.id}`);

      // Join user's personal room for notifications
      client.join(`user:${user.id}`);
      
      // Send welcome message with current stats
      client.emit('connected', {
        message: 'Connected to CV999 Casino',
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client as any).user;
    if (user) {
      this.activeConnections.delete(user.id);
      this.logger.log(`Client disconnected: ${user.id}`);
      
      // Remove from game rooms
      for (const [gameId, players] of this.gameRooms) {
        if (players.has(user.id)) {
          players.delete(user.id);
          this.updateGameStats(gameId);
        }
      }
    }
  }

  @SubscribeMessage('join-game')
  handleJoinGame(client: Socket, payload: { gameId: string }) {
    const user = (client as any).user;
    const { gameId } = payload;

    if (!user || !gameId) {
      return;
    }

    // Join game room
    client.join(`game:${gameId}`);
    
    // Add to game room tracking
    if (!this.gameRooms.has(gameId)) {
      this.gameRooms.set(gameId, new Set());
    }
    this.gameRooms.get(gameId).add(user.id);

    // Update game stats
    this.updateGameStats(gameId);

    // Notify others in the game
    client.to(`game:${gameId}`).emit('player-joined', {
      userId: user.id,
      username: user.email?.split('@')[0],
      timestamp: Date.now(),
    });

    this.logger.log(`User ${user.id} joined game ${gameId}`);
  }

  @SubscribeMessage('leave-game')
  handleLeaveGame(client: Socket, payload: { gameId: string }) {
    const user = (client as any).user;
    const { gameId } = payload;

    if (!user || !gameId) {
      return;
    }

    // Leave game room
    client.leave(`game:${gameId}`);
    
    // Remove from game room tracking
    const gameRoom = this.gameRooms.get(gameId);
    if (gameRoom) {
      gameRoom.delete(user.id);
      this.updateGameStats(gameId);
    }

    this.logger.log(`User ${user.id} left game ${gameId}`);
  }

  @SubscribeMessage('place-bet')
  handlePlaceBet(client: Socket, payload: GameBet) {
    const user = (client as any).user;
    if (!user) {
      return;
    }

    const bet: GameBet = {
      ...payload,
      userId: user.id,
      timestamp: Date.now(),
    };

    // Broadcast bet to game room (with delay for suspense)
    setTimeout(() => {
      this.server.to(`game:${payload.gameId}`).emit('bet-placed', bet);
    }, 1000);

    // Update game stats
    this.updateGameWagered(payload.gameId, payload.amount);

    this.logger.log(`User ${user.id} placed bet: ${payload.amount} on game ${payload.gameId}`);
  }

  @SubscribeMessage('game-win')
  handleGameWin(client: Socket, payload: { gameId: string; amount: number }) {
    const user = (client as any).user;
    if (!user) {
      return;
    }

    const winData = {
      userId: user.id,
      username: user.email?.split('@')[0],
      amount: payload.amount,
      gameId: payload.gameId,
      timestamp: Date.now(),
    };

    // Broadcast big wins to everyone
    if (payload.amount >= 10000) {
      this.server.emit('big-win', winData);
    } else {
      this.server.to(`game:${payload.gameId}`).emit('game-win', winData);
    }

    // Update game stats
    const stats = this.liveStats.get(payload.gameId);
    if (stats) {
      stats.recentWins.unshift(winData);
      if (stats.recentWins.length > 10) {
        stats.recentWins.pop();
      }
      this.server.to(`game:${payload.gameId}`).emit('game-stats', stats);
    }

    this.logger.log(`User ${user.id} won: ${payload.amount} on game ${payload.gameId}`);
  }

  @SubscribeMessage('get-game-stats')
  handleGetGameStats(client: Socket, payload: { gameId: string }) {
    const stats = this.liveStats.get(payload.gameId) || {
      gameId: payload.gameId,
      concurrentPlayers: 0,
      totalWagered: 0,
      recentWins: [],
    };
    
    client.emit('game-stats', stats);
  }

  private updateGameStats(gameId: string) {
    const players = this.gameRooms.get(gameId) || new Set();
    const stats = this.liveStats.get(gameId) || {
      gameId,
      concurrentPlayers: 0,
      totalWagered: 0,
      recentWins: [],
    };

    stats.concurrentPlayers = players.size;
    this.liveStats.set(gameId, stats);

    // Broadcast updated stats
    this.server.to(`game:${gameId}`).emit('game-stats', stats);
  }

  private updateGameWagered(gameId: string, amount: number) {
    const stats = this.liveStats.get(gameId);
    if (stats) {
      stats.totalWagered += amount;
      this.liveStats.set(gameId, stats);
    }
  }

  // Broadcast system-wide notifications
  broadcastSystemNotification(message: string, type: 'info' | 'warning' | 'success' = 'info') {
    this.server.emit('system-notification', {
      message,
      type,
      timestamp: Date.now(),
    });
  }

  // Send notification to specific user
  sendUserNotification(userId: string, message: string, data?: any) {
    this.server.to(`user:${userId}`).emit('user-notification', {
      message,
      data,
      timestamp: Date.now(),
    });
  }
}
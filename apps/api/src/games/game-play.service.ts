import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Game } from './game.entity';
import { GameSession } from './game-session.entity';

@Injectable()
export class GamePlayService {
  private readonly logger = new Logger(GamePlayService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GameSession)
    private gameSessionRepository: Repository<GameSession>,
  ) {}

  // Track game play and update user's total wagered amount
  async trackGamePlay(
    userId: string,
    gameId: string,
    betAmount: number,
    winAmount: number,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    // Update user's total wagered amount
    user.totalWagered += betAmount;
    
    // Update wallet statistics
    if (user.wallet) {
      if (winAmount > 0) {
        user.wallet.totalWon += winAmount;
      } else {
        user.wallet.totalLost += betAmount;
      }
    }

    await this.userRepository.save(user);

    // Create game session record
    const gameSession = this.gameSessionRepository.create({
      user,
      game: { id: gameId } as Game,
      betAmount,
      winAmount,
      startedAt: new Date(),
      endedAt: new Date(),
      duration: 0, // Calculate actual duration
      metadata: {
        wageredAmount: betAmount,
      },
    });

    await this.gameSessionRepository.save(gameSession);

    this.logger.log(`Game play tracked: User ${userId} wagered ${betAmount}, won ${winAmount}`);
  }

  // Check if user can withdraw
  async canUserWithdraw(userId: string): Promise<{ can: boolean; wagered: number; required: number }> {
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      select: ['totalWagered'],
    });

    if (!user) {
      return { can: false, wagered: 0, required: 500 };
    }

    const canWithdraw = user.totalWagered >= 500;
    
    return {
      can: canWithdraw,
      wagered: user.totalWagered,
      required: 500,
    };
  }

  // Get user's gambling statistics
  async getUserStats(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallet'],
    });

    if (!user) return null;

    // Calculate total games played
    const totalGames = await this.gameSessionRepository.count({
      where: { user: { id: userId } },
    });

    return {
      totalWagered: user.totalWagered,
      totalWithdrawn: user.totalWithdrawal,
      canWithdraw: user.totalWagered >= 500,
      withdrawalRequirement: {
        required: 500,
        wagered: user.totalWagered,
        remaining: Math.max(0, 500 - user.totalWagered),
      },
      totalGames,
      walletBalance: user.wallet?.balance || 0,
      lockedBalance: user.wallet?.lockedBalance || 0,
    };
  }
}
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { GameSession } from './game-session.entity';

export enum GameProvider {
  CUSTOM = 'custom',
  GAME_DISTRIBUTION = 'game_distribution',
  CRAZY_GAMES = 'crazy_games',
  POKI = 'poki',
  SOFTGAMES = 'softgames',
  HTML5 = 'html5',
}

export enum GameCategory {
  SLOT = 'slot',
  POKER = 'poker',
  BLACKJACK = 'blackjack',
  ROULETTE = 'roulette',
  BACCARAT = 'baccarat',
  SPORTS = 'sports',
  CASUAL = 'casual',
  ARCADE = 'arcade',
  PUZZLE = 'puzzle',
  STRATEGY = 'strategy',
  ADVENTURE = 'adventure',
}

@Entity('games')
@Index(['provider', 'externalId'], { unique: true })
@Index(['category', 'popularity'])
@Index(['isActive', 'featured'])
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  thumbnailUrl: string;

  @Column('text', { array: true, default: [] })
  screenshotUrls: string[];

  @Column({
    type: 'enum',
    enum: GameProvider,
  })
  provider: GameProvider;

  @Column({ nullable: true })
  externalId: string;

  @Column('text')
  gameUrl: string;

  @Column('text', { nullable: true })
  embedUrl: string;

  @Column('jsonb', { nullable: true })
  providerMetadata: Record<string, any>;

  @Column({
    type: 'enum',
    enum: GameCategory,
  })
  category: GameCategory;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ type: 'int', default: 0 })
  minBet: number;

  @Column({ type: 'int', default: 0 })
  maxBet: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rtp: number; // Return to Player percentage

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @Column({ type: 'int', default: 0 })
  popularity: number;

  @Column({ type: 'int', default: 0 })
  playCount: number;

  @Column({ type: 'int', default: 0 })
  concurrentPlayers: number;

  @Column({ type: 'jsonb', nullable: true })
  statistics: {
    totalWagered: number;
    totalPayout: number;
    averageBet: number;
    maxWin: number;
  };

  @OneToMany(() => GameSession, (session) => session.game)
  sessions: GameSession[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
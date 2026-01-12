import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Wallet } from '../wallet/wallet.entity';
import { GameSession } from '../games/game-session.entity';

export enum UserRole {
  PLAYER = 'player',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  AGENT = 'agent',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  PENDING_VERIFICATION = 'pending_verification',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  fullName: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  // Payment numbers
  @Column({ nullable: true })
  bkashNumber: string;

  @Column({ nullable: true })
  nagadNumber: string;

  @Column({ nullable: true })
  rocketNumber: string;

  @Column({ type: 'jsonb', default: {} })
  paymentMethods: {
    bkash?: {
      number: string;
      verified: boolean;
      verifiedAt?: Date;
    };
    nagad?: {
      number: string;
      verified: boolean;
      verifiedAt?: Date;
    };
    rocket?: {
      number: string;
      verified: boolean;
      verifiedAt?: Date;
    };
  };

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PLAYER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  @Column({ type: 'jsonb', nullable: true })
  verificationDocuments: {
    nidFront?: string;
    nidBack?: string;
    selfie?: string;
  };

  // Gambling limits
  @Column({ type: 'int', default: 0 })
  totalWagered: number; // মোট কত টাকা খেলেছেন

  @Column({ type: 'int', default: 0 })
  totalWithdrawal: number; // মোট কত টাকা উইথড্র করেছেন

  @Column({ type: 'int', default: 500 })
  minWithdrawalAmount: number; // সর্বনিম্ন উইথড্র

  @Column({ type: 'int', default: 50000 })
  maxWithdrawalAmount: number; // সর্বোচ্চ উইথড্র

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lastIpAddress: string;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => GameSession, (session) => session.user)
  gameSessions: GameSession[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  referralCode: string;

  @Column({ nullable: true })
  referredBy: string;

  // Helper method to check if user can withdraw
  canWithdraw(amount: number): { can: boolean; reason?: string } {
    if (amount < this.minWithdrawalAmount) {
      return { can: false, reason: `Minimum withdrawal is ${this.minWithdrawalAmount} BDT` };
    }
    
    if (amount > this.maxWithdrawalAmount) {
      return { can: false, reason: `Maximum withdrawal per day is ${this.maxWithdrawalAmount} BDT` };
    }
    
    // Check if user has wagered at least 500
    if (this.totalWagered < 500) {
      return { can: false, reason: 'You must wager at least 500 BDT before withdrawing' };
    }
    
    return { can: true };
  }
}
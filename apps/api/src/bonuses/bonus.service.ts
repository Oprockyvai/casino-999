import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Wallet } from '../wallet/wallet.entity';
import { Transaction, TransactionType, TransactionStatus } from '../wallet/transaction.entity';

interface DailyBonus {
  day: number;
  amount: number;
  multiplier: number;
  streakRequired: number;
}

interface UserBonusData {
  lastClaimDate: Date;
  currentStreak: number;
  totalBonusesClaimed: number;
  totalBonusAmount: number;
}

@Injectable()
export class BonusService {
  private readonly logger = new Logger(BonusService.name);
  
  private readonly dailyBonuses: DailyBonus[] = [
    { day: 1, amount: 10, multiplier: 1.0, streakRequired: 0 },
    { day: 2, amount: 15, multiplier: 1.1, streakRequired: 2 },
    { day: 3, amount: 20, multiplier: 1.2, streakRequired: 3 },
    { day: 4, amount: 25, multiplier: 1.3, streakRequired: 4 },
    { day: 5, amount: 30, multiplier: 1.5, streakRequired: 5 },
    { day: 6, amount: 40, multiplier: 1.8, streakRequired: 6 },
    { day: 7, amount: 50, multiplier: 2.0, streakRequired: 7 },
  ];

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async claimDailyBonus(userId: string): Promise<{ success: boolean; amount: number; streak: number }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallet'],
    });

    if (!user || !user.wallet) {
      throw new Error('User or wallet not found');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get user's bonus data
    const bonusData = await this.getUserBonusData(userId);
    const lastClaim = new Date(bonusData.lastClaimDate);
    const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

    // Check if already claimed today
    if (lastClaimDate.getTime() === today.getTime()) {
      return { success: false, amount: 0, streak: bonusData.currentStreak };
    }

    // Check if streak continues (claimed yesterday)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let newStreak = 1;
    if (lastClaimDate.getTime() === yesterday.getTime()) {
      newStreak = bonusData.currentStreak + 1;
    }

    // Calculate bonus amount
    const dayIndex = Math.min(newStreak, 7) - 1;
    const bonus = this.dailyBonuses[dayIndex];
    const amount = bonus.amount * bonus.multiplier;

    // Apply bonus to wallet
    user.wallet.balance += amount;
    await this.walletRepository.save(user.wallet);

    // Create transaction record
    const transaction = this.transactionRepository.create({
      wallet: user.wallet,
      amount,
      balanceBefore: user.wallet.balance - amount,
      balanceAfter: user.wallet.balance,
      type: TransactionType.BONUS,
      status: TransactionStatus.COMPLETED,
      transactionId: `BONUS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: `Daily Bonus - Day ${newStreak}`,
      metadata: {
        day: newStreak,
        baseAmount: bonus.amount,
        multiplier: bonus.multiplier,
        streak: newStreak,
      },
    });

    await this.transactionRepository.save(transaction);

    // Update user bonus data
    await this.updateUserBonusData(userId, {
      lastClaimDate: now,
      currentStreak: newStreak,
      totalBonusesClaimed: bonusData.totalBonusesClaimed + 1,
      totalBonusAmount: bonusData.totalBonusAmount + amount,
    });

    this.logger.log(`User ${userId} claimed daily bonus: ${amount} BDT (streak: ${newStreak})`);

    return {
      success: true,
      amount,
      streak: newStreak,
    };
  }

  async giveWelcomeBonus(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallet'],
    });

    if (!user || !user.wallet) {
      return;
    }

    const welcomeBonus = 50; // 50 BDT welcome bonus

    user.wallet.balance += welcomeBonus;
    await this.walletRepository.save(user.wallet);

    const transaction = this.transactionRepository.create({
      wallet: user.wallet,
      amount: welcomeBonus,
      balanceBefore: user.wallet.balance - welcomeBonus,
      balanceAfter: user.wallet.balance,
      type: TransactionType.BONUS,
      status: TransactionStatus.COMPLETED,
      transactionId: `WELCOME_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: 'Welcome Bonus',
    });

    await this.transactionRepository.save(transaction);
    this.logger.log(`Given welcome bonus to user ${userId}: ${welcomeBonus} BDT`);
  }

  async giveReferralBonus(referrerId: string, referredId: string): Promise<void> {
    const [referrer, referred] = await Promise.all([
      this.userRepository.findOne({ where: { id: referrerId }, relations: ['wallet'] }),
      this.userRepository.findOne({ where: { id: referredId }, relations: ['wallet'] }),
    ]);

    if (!referrer || !referred || !referrer.wallet || !referred.wallet) {
      return;
    }

    const referralBonus = 100; // 100 BDT referral bonus
    const referredBonus = 50; // 50 BDT for referred user

    // Give bonus to referrer
    referrer.wallet.balance += referralBonus;
    await this.walletRepository.save(referrer.wallet);

    await this.transactionRepository.save(
      this.transactionRepository.create({
        wallet: referrer.wallet,
        amount: referralBonus,
        balanceBefore: referrer.wallet.balance - referralBonus,
        balanceAfter: referrer.wallet.balance,
        type: TransactionType.BONUS,
        status: TransactionStatus.COMPLETED,
        transactionId: `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description: 'Referral Bonus',
        metadata: { referredUserId: referredId },
      })
    );

    // Give bonus to referred user
    referred.wallet.balance += referredBonus;
    await this.walletRepository.save(referred.wallet);

    await this.transactionRepository.save(
      this.transactionRepository.create({
        wallet: referred.wallet,
        amount: referredBonus,
        balanceBefore: referred.wallet.balance - referredBonus,
        balanceAfter: referred.wallet.balance,
        type: TransactionType.BONUS,
        status: TransactionStatus.COMPLETED,
        transactionId: `REFERRED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description: 'Referred Bonus',
        metadata: { referrerUserId: referrerId },
      })
    );

    this.logger.log(`Given referral bonuses: ${referrerId} got ${referralBonus}, ${referredId} got ${referredBonus}`);
  }

  async giveDepositBonus(userId: string, depositAmount: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallet'],
    });

    if (!user || !user.wallet) {
      return;
    }

    // Calculate bonus based on deposit amount (5% bonus, max 500 BDT)
    const bonusPercent = 0.05;
    const maxBonus = 500;
    const bonus = Math.min(depositAmount * bonusPercent, maxBonus);

    if (bonus <= 0) {
      return;
    }

    user.wallet.balance += bonus;
    await this.walletRepository.save(user.wallet);

    const transaction = this.transactionRepository.create({
      wallet: user.wallet,
      amount: bonus,
      balanceBefore: user.wallet.balance - bonus,
      balanceAfter: user.wallet.balance,
      type: TransactionType.BONUS,
      status: TransactionStatus.COMPLETED,
      transactionId: `DEPBONUS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: 'Deposit Bonus',
      metadata: {
        depositAmount,
        bonusPercent,
        calculatedBonus: bonus,
      },
    });

    await this.transactionRepository.save(transaction);
    this.logger.log(`Given deposit bonus to user ${userId}: ${bonus} BDT (deposit: ${depositAmount})`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetExpiredBonuses() {
    this.logger.log('Resetting expired bonus streaks...');
    
    // Reset streaks for users who didn't claim bonus for 2+ days
    // This would typically update records in a bonus tracking table
  }

  private async getUserBonusData(userId: string): Promise<UserBonusData> {
    // In production, you would have a separate bonus tracking table
    // This is a simplified version
    return {
      lastClaimDate: new Date(0),
      currentStreak: 0,
      totalBonusesClaimed: 0,
      totalBonusAmount: 0,
    };
  }

  private async updateUserBonusData(userId: string, data: Partial<UserBonusData>): Promise<void> {
    // Update bonus tracking data in database
  }
}
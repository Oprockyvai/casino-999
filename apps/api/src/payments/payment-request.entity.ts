import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../users/user.entity';

export enum PaymentRequestType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum PaymentRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  BKASH = 'bkash',
  NAGAD = 'nagad',
  ROCKET = 'rocket',
  USDT = 'usdt',
}

@Entity('payment_requests')
@Index(['userId', 'status'])
@Index(['transactionId', 'method'])
@Index(['createdAt'])
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: PaymentRequestType,
  })
  type: PaymentRequestType;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column()
  senderNumber: string; // যে নাম্বার থেকে টাকা পাঠানো হয়েছে

  @Column()
  receiverNumber: string; // যে নাম্বারে টাকা পাঠাতে হবে (আমাদের এজেন্টের নাম্বার)

  @Column()
  transactionId: string; // ইউজার দেওয়া ট্রানজেকশন আইডি

  @Column({ type: 'text', nullable: true })
  screenshot: string; // ট্রানজেকশন স্ক্রিনশট

  @Column({
    type: 'enum',
    enum: PaymentRequestStatus,
    default: PaymentRequestStatus.PENDING,
  })
  status: PaymentRequestStatus;

  @Column({ type: 'jsonb', nullable: true })
  adminNotes: {
    approvedBy?: string;
    approvedAt?: Date;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
    processedBy?: string;
    processedAt?: Date;
  };

  @Column({ type: 'text', nullable: true })
  notes: string; // ইউজারের নোট

  // For withdrawals
  @Column({ nullable: true })
  withdrawalAccount: string; // যে নাম্বারে উইথড্র করতে চায়

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isPending(): boolean {
    return this.status === PaymentRequestStatus.PENDING;
  }

  canBeProcessed(): boolean {
    return this.status === PaymentRequestStatus.APPROVED;
  }
}
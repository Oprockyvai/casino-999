import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentRequest, PaymentRequestType, PaymentRequestStatus, PaymentMethod } from './payment-request.entity';
import { User } from '../users/user.entity';
import { Wallet } from '../wallet/wallet.entity';
import { Transaction, TransactionType, TransactionStatus } from '../wallet/transaction.entity';

// আমাদের এজেন্ট/অ্যাডমিনের নাম্বারগুলো
const AGENT_NUMBERS = {
  [PaymentMethod.BKASH]: '01618848857', // আপনার বকাশ নাম্বার
  [PaymentMethod.NAGAD]: '01618848857', // আপনার নাগাদ নাম্বার
  [PaymentMethod.ROCKET]: '01618848857', // আপনার রকেট নাম্বার
};

@Injectable()
export class PaymentRequestService {
  private readonly logger = new Logger(PaymentRequestService.name);

  constructor(
    @InjectRepository(PaymentRequest)
    private paymentRequestRepository: Repository<PaymentRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  // Step 1: ইউজার পেমেন্ট রিকুয়েস্ট তৈরি করে
  async createPaymentRequest(
    userId: string,
    type: PaymentRequestType,
    method: PaymentMethod,
    amount: number,
    transactionId: string,
    senderNumber: string,
    screenshot?: string,
    notes?: string,
  ): Promise<PaymentRequest> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallet'],
    });

    if (!user || !user.wallet) {
      throw new BadRequestException('User not found');
    }

    // ভ্যালিডেশন
    await this.validateRequest(user, type, method, amount, transactionId, senderNumber);

    // ডিপোজিটের জন্য আমাদের এজেন্ট নাম্বার
    const receiverNumber = type === PaymentRequestType.DEPOSIT 
      ? AGENT_NUMBERS[method]
      : senderNumber; // উইথড্র হলে ইউজার নিজের নাম্বার

    // Withdrawal validation
    if (type === PaymentRequestType.WITHDRAWAL) {
      const canWithdraw = user.canWithdraw(amount);
      if (!canWithdraw.can) {
        throw new BadRequestException(canWithdraw.reason);
      }

      if (user.wallet.balance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Lock the amount
      user.wallet.balance -= amount;
      user.wallet.lockedBalance += amount;
      await this.walletRepository.save(user.wallet);
    }

    // পেমেন্ট রিকুয়েস্ট তৈরি
    const paymentRequest = this.paymentRequestRepository.create({
      user,
      userId: user.id,
      type,
      method,
      amount,
      senderNumber,
      receiverNumber,
      transactionId,
      screenshot,
      notes,
      status: PaymentRequestStatus.PENDING,
      withdrawalAccount: type === PaymentRequestType.WITHDRAWAL ? senderNumber : null,
    });

    await this.paymentRequestRepository.save(paymentRequest);

    // Create initial transaction record
    const transaction = this.transactionRepository.create({
      wallet: user.wallet,
      amount: type === PaymentRequestType.DEPOSIT ? amount : -amount,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance,
      type: type === PaymentRequestType.DEPOSIT ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      paymentMethod: method,
      transactionId: `${type.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        paymentRequestId: paymentRequest.id,
        userTransactionId: transactionId,
        senderNumber,
        receiverNumber,
      },
    });

    await this.transactionRepository.save(transaction);

    this.logger.log(`Payment request created: ${paymentRequest.id}, Type: ${type}, Amount: ${amount}, Method: ${method}`);
    
    return paymentRequest;
  }

  private async validateRequest(
    user: User,
    type: PaymentRequestType,
    method: PaymentMethod,
    amount: number,
    transactionId: string,
    senderNumber: string,
  ): Promise<void> {
    // Amount validation
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (type === PaymentRequestType.DEPOSIT) {
      if (amount < 10) {
        throw new BadRequestException('Minimum deposit is 10 BDT');
      }
      if (amount > 50000) {
        throw new BadRequestException('Maximum deposit per transaction is 50,000 BDT');
      }
    }

    if (type === PaymentRequestType.WITHDRAWAL) {
      if (amount < user.minWithdrawalAmount) {
        throw new BadRequestException(`Minimum withdrawal is ${user.minWithdrawalAmount} BDT`);
      }
      if (amount > user.maxWithdrawalAmount) {
        throw new BadRequestException(`Maximum withdrawal per day is ${user.maxWithdrawalAmount} BDT`);
      }
    }

    // Transaction ID validation
    if (!transactionId || transactionId.trim().length < 8) {
      throw new BadRequestException('Valid transaction ID is required (min 8 characters)');
    }

    // Check for duplicate transaction ID
    const existingRequest = await this.paymentRequestRepository.findOne({
      where: { transactionId, method, status: PaymentRequestStatus.PENDING },
    });

    if (existingRequest) {
      throw new BadRequestException('This transaction ID is already being processed');
    }

    // Mobile number validation
    const regex = /^(?:\+88|88)?(01[3-9]\d{8})$/;
    if (!regex.test(senderNumber)) {
      throw new BadRequestException('Invalid mobile number format. Use 01XXXXXXXXX');
    }

    // Clean number
    const cleanNumber = senderNumber.replace(/^(\+88|88)/, '');
    
    // Check if withdrawal number matches user's registered number
    if (type === PaymentRequestType.WITHDRAWAL) {
      const userPaymentInfo = user.paymentMethods[method];
      if (userPaymentInfo && userPaymentInfo.number !== cleanNumber) {
        throw new BadRequestException(`Withdrawal number must match your registered ${method} number`);
      }
    }
  }

  // Step 2: অ্যাডমিন রিকুয়েস্টগুলো দেখে এবং কনফার্ম করে
  async getPendingRequests(): Promise<PaymentRequest[]> {
    return this.paymentRequestRepository.find({
      where: { status: PaymentRequestStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async approveRequest(
    requestId: string,
    adminId: string,
    notes?: string,
  ): Promise<PaymentRequest> {
    const paymentRequest = await this.paymentRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user', 'user.wallet'],
    });

    if (!paymentRequest) {
      throw new BadRequestException('Payment request not found');
    }

    if (!paymentRequest.isPending()) {
      throw new BadRequestException('Request is not pending');
    }

    // Update request status
    paymentRequest.status = PaymentRequestStatus.APPROVED;
    paymentRequest.adminNotes = {
      ...paymentRequest.adminNotes,
      approvedBy: adminId,
      approvedAt: new Date(),
      rejectionReason: notes,
    };

    await this.paymentRequestRepository.save(paymentRequest);

    // Process the payment
    await this.processApprovedRequest(paymentRequest);

    this.logger.log(`Payment request approved: ${requestId} by admin ${adminId}`);
    
    return paymentRequest;
  }

  async rejectRequest(
    requestId: string,
    adminId: string,
    reason: string,
  ): Promise<PaymentRequest> {
    const paymentRequest = await this.paymentRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user', 'user.wallet'],
    });

    if (!paymentRequest) {
      throw new BadRequestException('Payment request not found');
    }

    if (!paymentRequest.isPending()) {
      throw new BadRequestException('Request is not pending');
    }

    // Update request status
    paymentRequest.status = PaymentRequestStatus.REJECTED;
    paymentRequest.adminNotes = {
      ...paymentRequest.adminNotes,
      rejectedBy: adminId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    };

    await this.paymentRequestRepository.save(paymentRequest);

    // If it was a withdrawal, unlock the amount
    if (paymentRequest.type === PaymentRequestType.WITHDRAWAL) {
      const wallet = paymentRequest.user.wallet;
      wallet.lockedBalance -= paymentRequest.amount;
      wallet.balance += paymentRequest.amount;
      await this.walletRepository.save(wallet);
    }

    // Update transaction status
    const transaction = await this.transactionRepository.findOne({
      where: {
        metadata: { paymentRequestId: requestId } as any,
      },
    });

    if (transaction) {
      transaction.status = TransactionStatus.FAILED;
      transaction.metadata = {
        ...transaction.metadata,
        rejectionReason: reason,
        rejectedBy: adminId,
      };
      await this.transactionRepository.save(transaction);
    }

    this.logger.log(`Payment request rejected: ${requestId} by admin ${adminId}, Reason: ${reason}`);
    
    return paymentRequest;
  }

  private async processApprovedRequest(paymentRequest: PaymentRequest): Promise<void> {
    const { user, type, amount, method } = paymentRequest;

    if (type === PaymentRequestType.DEPOSIT) {
      // Add money to user's wallet
      user.wallet.balance += amount;
      user.wallet.totalDeposited += amount;
      await this.walletRepository.save(user.wallet);

      // Update transaction
      const transaction = await this.transactionRepository.findOne({
        where: {
          metadata: { paymentRequestId: paymentRequest.id } as any,
        },
      });

      if (transaction) {
        transaction.status = TransactionStatus.COMPLETED;
        transaction.balanceAfter = user.wallet.balance;
        await this.transactionRepository.save(transaction);
      }

      // Update payment request status
      paymentRequest.status = PaymentRequestStatus.COMPLETED;
      paymentRequest.adminNotes = {
        ...paymentRequest.adminNotes,
        processedBy: 'system',
        processedAt: new Date(),
      };
      await this.paymentRequestRepository.save(paymentRequest);

      this.logger.log(`Deposit completed: ${amount} BDT added to user ${user.id}`);

    } else if (type === PaymentRequestType.WITHDRAWAL) {
      // Process withdrawal (send money to user)
      paymentRequest.status = PaymentRequestStatus.PROCESSING;
      await this.paymentRequestRepository.save(paymentRequest);

      // Here you would integrate with payment gateway to send money
      // For now, we'll mark it as completed after a delay
      setTimeout(async () => {
        // Unlock the amount and deduct from wallet
        user.wallet.lockedBalance -= amount;
        user.wallet.totalWithdrawn += amount;
        await this.walletRepository.save(user.wallet);

        // Update transaction
        const transaction = await this.transactionRepository.findOne({
          where: {
            metadata: { paymentRequestId: paymentRequest.id } as any,
          },
        });

        if (transaction) {
          transaction.status = TransactionStatus.COMPLETED;
          transaction.balanceAfter = user.wallet.balance;
          await this.transactionRepository.save(transaction);
        }

        // Update payment request
        paymentRequest.status = PaymentRequestStatus.COMPLETED;
        paymentRequest.adminNotes = {
          ...paymentRequest.adminNotes,
          processedBy: 'system',
          processedAt: new Date(),
        };
        await this.paymentRequestRepository.save(paymentRequest);

        this.logger.log(`Withdrawal completed: ${amount} BDT sent to ${paymentRequest.withdrawalAccount}`);
      }, 5000); // 5 seconds delay for simulation
    }
  }

  // ইউজার তার রিকুয়েস্ট হিস্টরি দেখতে পারবে
  async getUserRequests(userId: string): Promise<PaymentRequest[]> {
    return this.paymentRequestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // Get request by ID
  async getRequestById(requestId: string): Promise<PaymentRequest> {
    return this.paymentRequestRepository.findOne({
      where: { id: requestId },
      relations: ['user'],
    });
  }
}
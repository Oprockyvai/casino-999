import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { Transaction, TransactionType, TransactionStatus, PaymentMethod } from '../wallet/transaction.entity';
import { Wallet } from '../wallet/wallet.entity';
import { User } from '../users/user.entity';

interface BkashPaymentRequest {
  amount: number;
  orderId: string;
  customerPhone: string;
}

interface BkashPaymentResponse {
  paymentID: string;
  createTime: string;
  orgLogo: string;
  statusCode: string;
  statusMessage: string;
}

interface CryptoRate {
  usdt: number;
  btc: number;
  eth: number;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
  ) {}

  async createDeposit(user: User, amount: number, method: PaymentMethod, metadata: any) {
    const wallet = await this.walletRepository.findOne({ where: { user: { id: user.id } } });
    
    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    // Create transaction record
    const transaction = this.transactionRepository.create({
      wallet,
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      paymentMethod: method,
      transactionId: `DEP_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      metadata,
    });

    await this.transactionRepository.save(transaction);

    // Process based on payment method
    switch (method) {
      case PaymentMethod.BKASH:
        return await this.processBkashPayment(transaction, metadata);
      case PaymentMethod.NAGAD:
        return await this.processNagadPayment(transaction, metadata);
      case PaymentMethod.USDT:
        return await this.processCryptoPayment(transaction, metadata);
      default:
        throw new BadRequestException('Unsupported payment method');
    }
  }

  private async processBkashPayment(transaction: Transaction, metadata: any): Promise<any> {
    const bkashConfig = {
      appKey: this.configService.get('BKASH_APP_KEY'),
      appSecret: this.configService.get('BKASH_APP_SECRET'),
      username: this.configService.get('BKASH_USERNAME'),
      password: this.configService.get('BKASH_PASSWORD'),
      isSandbox: this.configService.get('BKASH_SANDBOX') === 'true',
    };

    try {
      // Step 1: Get token
      const tokenResponse = await axios.post(
        bkashConfig.isSandbox 
          ? 'https://checkout.sandbox.bka.sh/v1.2.0-beta/checkout/token/grant'
          : 'https://checkout.pay.bka.sh/v1.2.0-beta/checkout/token/grant',
        {
          app_key: bkashConfig.appKey,
          app_secret: bkashConfig.appSecret,
        },
        {
          headers: {
            username: bkashConfig.username,
            password: bkashConfig.password,
          },
        }
      );

      const token = tokenResponse.data.id_token;

      // Step 2: Create payment
      const paymentResponse = await axios.post(
        bkashConfig.isSandbox
          ? 'https://checkout.sandbox.bka.sh/v1.2.0-beta/checkout/payment/create'
          : 'https://checkout.pay.bka.sh/v1.2.0-beta/checkout/payment/create',
        {
          amount: transaction.amount.toString(),
          currency: 'BDT',
          intent: 'sale',
          merchantInvoiceNumber: transaction.transactionId,
        },
        {
          headers: {
            Authorization: token,
            'X-APP-Key': bkashConfig.appKey,
          },
        }
      );

      return {
        paymentId: paymentResponse.data.paymentID,
        bkashURL: paymentResponse.data.bkashURL,
        transaction,
      };
    } catch (error) {
      this.logger.error('Bkash payment error:', error);
      throw new BadRequestException('Failed to process bKash payment');
    }
  }

  private async processNagadPayment(transaction: Transaction, metadata: any): Promise<any> {
    const nagadConfig = {
      merchantId: this.configService.get('NAGAD_MERCHANT_ID'),
      merchantNumber: this.configService.get('NAGAD_MERCHANT_NUMBER'),
      isSandbox: this.configService.get('NAGAD_SANDBOX') === 'true',
    };

    try {
      // Generate unique order ID
      const orderId = `NAGAD_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      // In production, you would call Nagad's API here
      // This is a simplified version
      
      return {
        paymentUrl: nagadConfig.isSandbox
          ? `https://sandbox.mynagad.com/checkout?orderId=${orderId}`
          : `https://checkout.mynagad.com/checkout?orderId=${orderId}`,
        orderId,
        transaction,
      };
    } catch (error) {
      this.logger.error('Nagad payment error:', error);
      throw new BadRequestException('Failed to process Nagad payment');
    }
  }

  private async processCryptoPayment(transaction: Transaction, metadata: any): Promise<any> {
    try {
      // Get current USDT to BDT rate
      const rate = await this.getCryptoRates();
      const usdtAmount = transaction.amount / rate.usdt;

      // Generate unique payment address
      const paymentAddress = this.generateCryptoAddress(metadata.currency || 'USDT');

      // Store payment details
      transaction.metadata = {
        ...transaction.metadata,
        cryptoAmount: usdtAmount,
        paymentAddress,
        exchangeRate: rate.usdt,
        currency: metadata.currency || 'USDT',
      };

      await this.transactionRepository.save(transaction);

      return {
        paymentAddress,
        amountInCrypto: usdtAmount,
        exchangeRate: rate.usdt,
        currency: metadata.currency || 'USDT',
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${paymentAddress}`,
        transaction,
      };
    } catch (error) {
      this.logger.error('Crypto payment error:', error);
      throw new BadRequestException('Failed to process crypto payment');
    }
  }

  private async getCryptoRates(): Promise<CryptoRate> {
    try {
      // Fetch rates from CoinGecko
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=tether,bitcoin,ethereum&vs_currencies=bdt'
      );

      return {
        usdt: response.data.tether.bdt,
        btc: response.data.bitcoin.bdt,
        eth: response.data.ethereum.bdt,
      };
    } catch (error) {
      this.logger.warn('Failed to fetch crypto rates, using fallback');
      return {
        usdt: 110, // Fallback rate
        btc: 4000000,
        eth: 300000,
      };
    }
  }

  private generateCryptoAddress(currency: string): string {
    // This should be implemented with your crypto wallet service
    // For example, using Trust Wallet, MetaMask, or a custom solution
    const prefix = currency.toLowerCase();
    const randomHash = crypto.randomBytes(16).toString('hex');
    return `0x${randomHash}`;
  }

  async verifyPayment(transactionId: string, providerData: any): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { transactionId },
      relations: ['wallet'],
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Verify payment based on provider
    let verified = false;
    switch (transaction.paymentMethod) {
      case PaymentMethod.BKASH:
        verified = await this.verifyBkashPayment(transaction, providerData);
        break;
      case PaymentMethod.NAGAD:
        verified = await this.verifyNagadPayment(transaction, providerData);
        break;
      case PaymentMethod.USDT:
        verified = await this.verifyCryptoPayment(transaction, providerData);
        break;
    }

    if (verified) {
      // Update wallet balance
      transaction.wallet.balance += transaction.amount;
      transaction.wallet.totalDeposited += transaction.amount;
      transaction.balanceAfter = transaction.wallet.balance;
      transaction.status = TransactionStatus.COMPLETED;

      await this.walletRepository.save(transaction.wallet);
      await this.transactionRepository.save(transaction);
    } else {
      transaction.status = TransactionStatus.FAILED;
      await this.transactionRepository.save(transaction);
    }

    return transaction;
  }

  private async verifyBkashPayment(transaction: Transaction, data: any): Promise<boolean> {
    // Implement bKash payment verification
    return true; // Placeholder
  }

  private async verifyNagadPayment(transaction: Transaction, data: any): Promise<boolean> {
    // Implement Nagad payment verification
    return true; // Placeholder
  }

  private async verifyCryptoPayment(transaction: Transaction, data: any): Promise<boolean> {
    // Implement crypto payment verification
    return true; // Placeholder
  }

  async createWithdrawal(user: User, amount: number, method: PaymentMethod, accountDetails: any) {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: user.id } },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Minimum withdrawal amount
    const minWithdrawal = method === PaymentMethod.USDT ? 500 : 100;
    if (amount < minWithdrawal) {
      throw new BadRequestException(`Minimum withdrawal is ${minWithdrawal} BDT`);
    }

    // Create withdrawal transaction
    const transaction = this.transactionRepository.create({
      wallet,
      amount: -amount, // Negative for withdrawal
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance - amount,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      paymentMethod: method,
      transactionId: `WDR_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      metadata: accountDetails,
    });

    // Lock the amount
    wallet.balance -= amount;
    wallet.lockedBalance += amount;

    await this.walletRepository.save(wallet);
    await this.transactionRepository.save(transaction);

    // Process withdrawal based on method
    await this.processWithdrawal(transaction, accountDetails);

    return transaction;
  }

  private async processWithdrawal(transaction: Transaction, accountDetails: any) {
    // Implement withdrawal processing
    // This would involve calling the respective payment provider's API
  }
}
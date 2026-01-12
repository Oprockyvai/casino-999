import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class RateLimiterGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Use IP + user agent for tracking
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || '';
    return `${ip}:${userAgent}`;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
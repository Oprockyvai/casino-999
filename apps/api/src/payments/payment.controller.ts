import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { PaymentRequestService } from './payment-request.service';
import { PaymentRequestType, PaymentMethod, PaymentRequestStatus } from './payment-request.entity';

class CreatePaymentRequestDto {
  type: PaymentRequestType;
  method: PaymentMethod;
  amount: number;
  transactionId: string;
  senderNumber: string;
  notes?: string;
}

class UpdatePaymentStatusDto {
  status: PaymentRequestStatus;
  reason?: string;
}

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentRequestService: PaymentRequestService) {}

  // ইউজার পেমেন্ট রিকুয়েস্ট তৈরি করে
  @Post('request')
  @ApiOperation({ summary: 'Create payment request' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('screenshot'))
  async createPaymentRequest(
    @Body() body: CreatePaymentRequestDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: 'image/*' }),
        ],
        fileIsRequired: false,
      }),
    )
    screenshot?: Express.Multer.File,
    @Body('userId') userId?: string,
  ) {
    // In production, get userId from JWT token
    const actualUserId = userId; // Replace with actual user from token
    
    const screenshotUrl = screenshot 
      ? `/uploads/payments/${screenshot.filename}`
      : undefined;

    return this.paymentRequestService.createPaymentRequest(
      actualUserId,
      body.type,
      body.method,
      body.amount,
      body.transactionId,
      body.senderNumber,
      screenshotUrl,
      body.notes,
    );
  }

  // অ্যাডমিন পেন্ডিং রিকুয়েস্টগুলো দেখে
  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Get pending payment requests (Admin only)' })
  @ApiBearerAuth()
  async getPendingRequests() {
    return this.paymentRequestService.getPendingRequests();
  }

  // অ্যাডমিন রিকুয়েস্ট অ্যাপ্রুভ করে
  @Put('admin/approve/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Approve payment request (Admin only)' })
  @ApiBearerAuth()
  async approveRequest(
    @Param('id') requestId: string,
    @Body() body: { adminId: string; notes?: string },
  ) {
    return this.paymentRequestService.approveRequest(
      requestId,
      body.adminId,
      body.notes,
    );
  }

  // অ্যাডমিন রিকুয়েস্ট রিজেক্ট করে
  @Put('admin/reject/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Reject payment request (Admin only)' })
  @ApiBearerAuth()
  async rejectRequest(
    @Param('id') requestId: string,
    @Body() body: { adminId: string; reason: string },
  ) {
    return this.paymentRequestService.rejectRequest(
      requestId,
      body.adminId,
      body.reason,
    );
  }

  // ইউজার তার রিকুয়েস্ট হিস্টরি দেখে
  @Get('my-requests')
  @ApiOperation({ summary: 'Get my payment requests' })
  @ApiBearerAuth()
  async getMyRequests(@Body('userId') userId: string) {
    return this.paymentRequestService.getUserRequests(userId);
  }

  // Specific request details
  @Get('request/:id')
  @ApiOperation({ summary: 'Get payment request by ID' })
  @ApiBearerAuth()
  async getRequest(@Param('id') requestId: string) {
    return this.paymentRequestService.getRequestById(requestId);
  }
}
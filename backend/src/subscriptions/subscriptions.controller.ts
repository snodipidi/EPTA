import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Public } from '../common';
import { ChangeTierDto } from './dto/change-tier.dto';
import {
  PlanDto,
  SubscriptionResponseDto,
} from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Available subscription plans' })
  @ApiOkResponse({ type: [PlanDto] })
  plans(): PlanDto[] {
    return this.subscriptions.getPlans();
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'My current subscription' })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  mine(@CurrentUser('id') userId: string): Promise<SubscriptionResponseDto> {
    return this.subscriptions.getMine(userId);
  }

  @ApiBearerAuth('access-token')
  @Put('me')
  @ApiOperation({ summary: 'Change my subscription tier' })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  change(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangeTierDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptions.changeTier(userId, dto.tier);
  }

  @ApiBearerAuth('access-token')
  @Post('me/cancel')
  @ApiOperation({ summary: 'Cancel my subscription at period end' })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  cancel(@CurrentUser('id') userId: string): Promise<SubscriptionResponseDto> {
    return this.subscriptions.cancel(userId);
  }
}

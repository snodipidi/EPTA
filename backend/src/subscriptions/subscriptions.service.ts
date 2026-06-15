import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PlanDto,
  SubscriptionResponseDto,
} from './dto/subscription-response.dto';

/**
 * Subscription entitlements (free / pro / vip). DECISION: this models the user's
 * *entitlement* only. Real payment capture (Stripe, etc.) is a separate concern
 * that would call `activate()` from a verified webhook — the `externalCustomerId`
 * + `currentPeriodEnd` columns are already in place for it. Here, tier changes
 * are applied directly so the rest of the app can gate features today.
 */
@Injectable()
export class SubscriptionsService {
  /** Static plan catalog surfaced to the "Подписка" page. */
  private static readonly PLANS: PlanDto[] = [
    {
      tier: SubscriptionTier.FREE,
      name: 'Free',
      priceMonthly: 0,
      features: ['Лента подписок', 'Базовые реакции', 'Личные чаты'],
    },
    {
      tier: SubscriptionTier.PRO,
      name: 'Pro',
      priceMonthly: 29900,
      features: [
        'Всё из Free',
        'Расширенные реакции',
        'Загрузка видео',
        'Бейдж Pro',
      ],
    },
    {
      tier: SubscriptionTier.VIP,
      name: 'VIP',
      priceMonthly: 99900,
      features: [
        'Всё из Pro',
        'Приоритет в рекомендациях',
        'Аналитика профиля',
        'Бейдж VIP',
      ],
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  getPlans(): PlanDto[] {
    return SubscriptionsService.PLANS;
  }

  async getMine(userId: string): Promise<SubscriptionResponseDto> {
    let sub = await this.prisma.subscription.findUnique({ where: { userId } });
    // Self-heal: every user should have at least a FREE row.
    sub ??= await this.prisma.subscription.create({
      data: { userId, tier: SubscriptionTier.FREE },
    });
    return this.toResponse(sub);
  }

  async changeTier(
    userId: string,
    tier: SubscriptionTier,
  ): Promise<SubscriptionResponseDto> {
    const periodEnd =
      tier === SubscriptionTier.FREE
        ? null
        : new Date(Date.now() + 30 * 24 * 3600 * 1000);

    const sub = await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
      update: {
        tier,
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
      },
    });
    return this.toResponse(sub);
  }

  async cancel(userId: string): Promise<SubscriptionResponseDto> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!sub) throw new NotFoundException('No subscription');
    // Cancel at period end — keep access until the paid period expires.
    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true, status: SubscriptionStatus.CANCELED },
    });
    return this.toResponse(updated);
  }

  private toResponse(sub: Subscription): SubscriptionResponseDto {
    return {
      tier: sub.tier,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }
}

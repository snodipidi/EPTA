import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Global so any domain service (follows, reactions, comments) can inject
 * NotificationsService to emit a notification without a web of feature-module
 * imports. The module itself depends on nothing but global infra (Prisma/Redis),
 * keeping the dependency graph acyclic.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

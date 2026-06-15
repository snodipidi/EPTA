import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

/**
 * Chats: REST controller + Socket.IO gateway sharing one ChatsService (single
 * source of truth for persistence). JwtModule is registered for the gateway's
 * handshake auth; UsersModule provides BlockService for DM block checks.
 */
@Module({
  imports: [JwtModule.register({}), UsersModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatGateway],
  exports: [ChatsService],
})
export class ChatsModule {}

import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtConfig } from '../config/configuration';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { REALTIME_NOTIFICATION_CHANNEL } from '../notifications/notifications.service';
import { RedisService } from '../redis/redis.service';
import { ChatsService } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';

interface SocketData {
  user: AuthenticatedUser;
}
// Only override the `data` payload type; keep default (permissive) event maps so
// `emit(event, payload)` stays callable.
type AppSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

/**
 * Real-time chat + notification delivery. Auth happens once on connection
 * (JWT in the handshake). Each socket joins its personal room `user:<id>` (for
 * notifications) and any chat rooms `chat:<id>` it opens. Cross-instance fan-out
 * is handled by the Redis Socket.IO adapter (see RedisIoAdapter); notification
 * push is bridged from the Redis pub/sub channel that NotificationsService emits.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);
  private subscriber?: Redis;

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly chats: ChatsService,
    private readonly redis: RedisService,
  ) {}

  afterInit(): void {
    // Dedicated subscriber connection bridges NotificationsService → sockets.
    this.subscriber = this.redis.client.duplicate();
    void this.subscriber.subscribe(REALTIME_NOTIFICATION_CHANNEL);
    this.subscriber.on('message', (_channel, raw) => {
      try {
        const { userId, notification } = JSON.parse(raw) as {
          userId: string;
          notification: unknown;
        };
        this.server
          .to(this.userRoom(userId))
          .emit('notification', notification);
      } catch {
        // ignore malformed payloads
      }
    });
  }

  handleConnection(client: AppSocket): void {
    try {
      const token = this.extractToken(client);
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<JwtConfig>('jwt').accessSecret,
      });
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
        role: payload.role,
      };
      void client.join(this.userRoom(payload.sub));
      this.logger.debug(`Socket connected: ${payload.username}`);
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { chatId: string },
  ): Promise<{ joined: string }> {
    await this.chats.assertMember(body.chatId, client.data.user.id);
    await client.join(this.chatRoom(body.chatId));
    return { joined: body.chatId };
  }

  @SubscribeMessage('chat:leave')
  onLeave(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { chatId: string },
  ): void {
    void client.leave(this.chatRoom(body.chatId));
  }

  @SubscribeMessage('chat:message')
  async onMessage(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: SendMessageDto & { chatId: string },
  ): Promise<void> {
    if (!body?.chatId) throw new WsException('chatId is required');
    const message = await this.chats.sendMessage(
      body.chatId,
      client.data.user.id,
      body,
    );
    // Broadcast to everyone currently in the chat room (incl. the sender, so the
    // sender's other devices stay in sync).
    this.server.to(this.chatRoom(body.chatId)).emit('chat:message', message);
  }

  @SubscribeMessage('chat:typing')
  onTyping(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { chatId: string },
  ): void {
    client.to(this.chatRoom(body.chatId)).emit('chat:typing', {
      chatId: body.chatId,
      userId: client.data.user.id,
    });
  }

  @SubscribeMessage('chat:read')
  async onRead(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { chatId: string },
  ): Promise<void> {
    await this.chats.markRead(body.chatId, client.data.user.id);
    client.to(this.chatRoom(body.chatId)).emit('chat:read', {
      chatId: body.chatId,
      userId: client.data.user.id,
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private extractToken(client: AppSocket): string {
    const fromAuth = (client.handshake.auth as { token?: string })?.token;
    const fromHeader = client.handshake.headers.authorization?.replace(
      /^Bearer\s+/i,
      '',
    );
    const token = fromAuth ?? fromHeader;
    if (!token) throw new UnauthorizedException('Missing token');
    return token;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private chatRoom(chatId: string): string {
    return `chat:${chatId}`;
  }
}

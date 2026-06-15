import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatMemberRole, ChatType, Prisma } from '@prisma/client';
import { buildCursorPage, PaginatedResult } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BlockService } from '../users/services/block.service';
import {
  ChatMessageResponseDto,
  ChatResponseDto,
} from './dto/chat-response.dto';
import { CreateGroupChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

const chatInclude = {
  members: {
    where: { leftAt: null },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  },
} satisfies Prisma.ChatInclude;

type ChatWithMembers = Prisma.ChatGetPayload<{ include: typeof chatInclude }>;

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlockService,
  ) {}

  // ── Chats ──────────────────────────────────────────────────────────────

  /** Idempotently get (or create) the 1:1 chat between two users. */
  async getOrCreateDirect(
    userId: string,
    otherUsername: string,
  ): Promise<ChatResponseDto> {
    const other = await this.prisma.user.findUnique({
      where: { username: otherUsername },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('User not found');
    if (other.id === userId) {
      throw new ForbiddenException('Cannot start a chat with yourself');
    }
    if (await this.blocks.isBlockedEitherWay(userId, other.id)) {
      throw new ForbiddenException('Cannot message this user');
    }

    // Canonical key prevents duplicate DMs regardless of who initiates.
    const directKey = [userId, other.id].sort().join(':');

    const chat = await this.prisma.chat.upsert({
      where: { directKey },
      create: {
        type: ChatType.DIRECT,
        directKey,
        members: {
          create: [
            { userId, role: ChatMemberRole.MEMBER },
            { userId: other.id, role: ChatMemberRole.MEMBER },
          ],
        },
      },
      update: {},
      include: chatInclude,
    });

    return this.toChatResponse(chat, userId, 0);
  }

  async createGroup(
    ownerId: string,
    dto: CreateGroupChatDto,
  ): Promise<ChatResponseDto> {
    const members = await this.prisma.user.findMany({
      where: { username: { in: dto.memberUsernames }, status: 'ACTIVE' },
      select: { id: true },
    });
    const memberIds = new Set(members.map((m) => m.id));
    memberIds.delete(ownerId); // owner added separately as OWNER

    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        members: {
          create: [
            { userId: ownerId, role: ChatMemberRole.OWNER },
            ...[...memberIds].map((userId) => ({
              userId,
              role: ChatMemberRole.MEMBER,
            })),
          ],
        },
      },
      include: chatInclude,
    });
    return this.toChatResponse(chat, ownerId, 0);
  }

  async listMine(userId: string): Promise<ChatResponseDto[]> {
    const chats = await this.prisma.chat.findMany({
      where: { members: { some: { userId, leftAt: null } } },
      include: chatInclude,
      orderBy: { lastMessageAt: 'desc' },
    });

    // Tally unread per chat in a single query (receipts not yet read by me).
    const unreadByChat = await this.unreadCountsByChat(userId);

    return chats.map((c) =>
      this.toChatResponse(c, userId, unreadByChat.get(c.id) ?? 0),
    );
  }

  // ── Messages ─────────────────────────────────────────────────────────────

  async getMessages(
    chatId: string,
    userId: string,
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<ChatMessageResponseDto>> {
    await this.assertMember(chatId, userId);
    const rows = await this.prisma.chatMessage.findMany({
      where: { chatId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const page = buildCursorPage(rows, params.limit);
    return new PaginatedResult(
      page.items.map((m) => this.toMessageResponse(m)),
      page.nextCursor,
    );
  }

  /**
   * Persist a message + per-recipient receipts + bump the chat's lastMessageAt,
   * all atomically. Returns the saved message; real-time broadcast is the
   * gateway's job (kept out of the service so REST and WS share this path).
   */
  async sendMessage(
    chatId: string,
    senderId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageResponseDto> {
    const memberIds = await this.assertMember(chatId, senderId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          chatId,
          senderId,
          text: dto.text,
          mediaIds: dto.mediaIds ?? [],
          replyToId: dto.replyToId,
        },
      });
      await tx.chat.update({
        where: { id: chatId },
        data: { lastMessageAt: created.createdAt },
      });
      // One receipt per OTHER member, so unread badges and "seen by" work.
      const recipients = memberIds.filter((id) => id !== senderId);
      if (recipients.length) {
        await tx.messageReceipt.createMany({
          data: recipients.map((userId) => ({
            messageId: created.id,
            userId,
            deliveredAt: new Date(),
          })),
        });
      }
      return created;
    });

    return this.toMessageResponse(message);
  }

  /** Mark all messages in a chat as read for the user. */
  async markRead(chatId: string, userId: string): Promise<void> {
    await this.assertMember(chatId, userId);
    await this.prisma.messageReceipt.updateMany({
      where: { userId, readAt: null, message: { chatId } },
      data: { readAt: new Date() },
    });
  }

  /** Member ids of a chat, or throw if the user isn't a member. */
  async assertMember(chatId: string, userId: string): Promise<string[]> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: { where: { leftAt: null }, select: { userId: true } },
      },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    const ids = chat.members.map((m) => m.userId);
    if (!ids.includes(userId)) {
      throw new ForbiddenException('You are not a member of this chat');
    }
    return ids;
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async unreadCountsByChat(
    userId: string,
  ): Promise<Map<string, number>> {
    const unread = await this.prisma.messageReceipt.findMany({
      where: { userId, readAt: null },
      select: { message: { select: { chatId: true } } },
    });
    const map = new Map<string, number>();
    for (const r of unread) {
      const chatId = r.message.chatId;
      map.set(chatId, (map.get(chatId) ?? 0) + 1);
    }
    return map;
  }

  private toChatResponse(
    chat: ChatWithMembers,
    _viewerId: string,
    unreadCount: number,
  ): ChatResponseDto {
    return {
      id: chat.id,
      type: chat.type,
      name: chat.name ?? undefined,
      avatarUrl: chat.avatarUrl ?? undefined,
      members: chat.members.map((m) => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.profile?.displayName ?? m.user.username,
        avatarUrl: m.user.profile?.avatarUrl ?? undefined,
        role: m.role,
      })),
      lastMessageAt: chat.lastMessageAt?.toISOString(),
      unreadCount,
    };
  }

  private toMessageResponse(m: {
    id: string;
    chatId: string;
    senderId: string;
    text: string | null;
    mediaIds: string[];
    replyToId: string | null;
    createdAt: Date;
    editedAt: Date | null;
  }): ChatMessageResponseDto {
    return {
      id: m.id,
      chatId: m.chatId,
      senderId: m.senderId,
      text: m.text ?? undefined,
      mediaIds: m.mediaIds,
      replyToId: m.replyToId ?? undefined,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt?.toISOString(),
    };
  }
}

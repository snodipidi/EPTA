import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaAsset, MediaStatus, MediaType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { S3Config } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { QueueProducer } from '../queues/queue.producer';
import { MediaResponseDto } from './dto/media-response.dto';
import { STORAGE_SERVICE, StorageService } from './storage/storage.service';

/** Whitelisted upload types → our MediaType enum. */
const MIME_MAP: Record<string, MediaType> = {
  'image/jpeg': MediaType.IMAGE,
  'image/png': MediaType.IMAGE,
  'image/webp': MediaType.IMAGE,
  'image/gif': MediaType.GIF,
  'video/mp4': MediaType.VIDEO,
  'video/webm': MediaType.VIDEO,
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  originalName?: string;
}

@Injectable()
export class MediaService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly queue: QueueProducer,
    config: ConfigService,
  ) {
    this.bucket = config.getOrThrow<S3Config>('s3').bucket;
  }

  async upload(ownerId: string, file: UploadInput): Promise<MediaResponseDto> {
    this.validate(file);
    const type = MIME_MAP[file.mimeType];
    const ext = this.extFor(file.mimeType);
    const key = `media/${ownerId}/${randomUUID()}.${ext}`;

    await this.storage.put(key, file.buffer, file.mimeType);

    // DECISION: images are usable immediately (status READY); a follow-up queue
    // job generates thumbnails/variants and runs moderation. Heavier types
    // (video) would start PENDING and flip to READY after transcoding.
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId,
        type,
        status:
          type === MediaType.VIDEO ? MediaStatus.PENDING : MediaStatus.READY,
        storageKey: key,
        bucket: this.bucket,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        altText: file.originalName,
      },
    });

    // Hand off to the async pipeline (variants + moderation). Non-blocking.
    await this.queue.processMedia({ mediaId: asset.id });

    return this.toResponse(asset);
  }

  async findOne(id: string, viewerId: string): Promise<MediaResponseDto> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media not found');
    // Only the owner can read raw metadata; public consumption is via post URLs.
    if (asset.ownerId !== viewerId) {
      throw new NotFoundException('Media not found');
    }
    return this.toResponse(asset);
  }

  private validate(file: UploadInput): void {
    if (!file || file.sizeBytes === 0) {
      throw new BadRequestException('Empty file');
    }
    if (!MIME_MAP[file.mimeType]) {
      throw new BadRequestException(
        `Unsupported media type "${file.mimeType}". Allowed: ${Object.keys(
          MIME_MAP,
        ).join(', ')}`,
      );
    }
    if (file.sizeBytes > MAX_BYTES) {
      throw new BadRequestException('File exceeds the 10 MB limit');
    }
  }

  private extFor(mime: string): string {
    return (
      {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
      }[mime] ?? 'bin'
    );
  }

  private toResponse(asset: MediaAsset): MediaResponseDto {
    return {
      id: asset.id,
      type: asset.type,
      status: asset.status,
      url: this.storage.publicUrl(asset.storageKey),
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
    };
  }
}

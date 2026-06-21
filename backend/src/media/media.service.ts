import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaAsset, MediaStatus, MediaType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { S3Config } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { QueueProducer } from '../queues/queue.producer';
import { MediaResponseDto } from './dto/media-response.dto';
import { STORAGE_SERVICE, StorageService } from './storage/storage.service';

/** Canonical media types we accept, keyed off the file's real signature. */
type DetectedType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'video/mp4'
  | 'video/webm';

const TYPE_TO_MEDIA: Record<DetectedType, MediaType> = {
  'image/jpeg': MediaType.IMAGE,
  'image/png': MediaType.IMAGE,
  'image/webp': MediaType.IMAGE,
  'image/gif': MediaType.GIF,
  'video/mp4': MediaType.VIDEO,
  'video/webm': MediaType.VIDEO,
};

const EXT_FOR: Record<DetectedType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const IMAGE_TYPES: ReadonlySet<DetectedType> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export interface UploadInput {
  buffer: Buffer;
  /** Client-declared MIME — recorded for reference only, never trusted. */
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
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Empty file');
    }
    if (file.buffer.length > MAX_BYTES) {
      throw new BadRequestException('File exceeds the 10 MB limit');
    }

    // SECURITY: trust the bytes, not the client-declared MIME. Sniff the real
    // type from the file signature; anything we can't positively identify as an
    // allowed image/video (e.g. SVG, HTML, scripts) is rejected here.
    const detected = this.detectType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        `Unsupported or unrecognized file content. Allowed: ${Object.keys(
          TYPE_TO_MEDIA,
        ).join(', ')}`,
      );
    }

    // Images: re-encode through sharp. This both proves the bytes really decode
    // as that image and strips any embedded payload / metadata / polyglot.
    let buffer = file.buffer;
    if (IMAGE_TYPES.has(detected)) {
      buffer = await this.reencodeImage(file.buffer, detected);
      if (buffer.length > MAX_BYTES) {
        throw new BadRequestException('File exceeds the 10 MB limit');
      }
    }

    const type = TYPE_TO_MEDIA[detected];
    const ext = EXT_FOR[detected];
    const key = `media/${ownerId}/${randomUUID()}.${ext}`;

    await this.storage.put(key, buffer, detected);

    // DECISION: images are usable immediately (status READY); a follow-up queue
    // job generates thumbnails/variants and runs moderation. Heavier types
    // (video) start PENDING and flip to READY after transcoding.
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId,
        type,
        status:
          type === MediaType.VIDEO ? MediaStatus.PENDING : MediaStatus.READY,
        storageKey: key,
        bucket: this.bucket,
        mimeType: detected,
        sizeBytes: buffer.length,
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

  /**
   * Identify a file by its magic bytes. Returns the canonical MIME for the
   * allowed types, or null when the signature isn't one we accept.
   */
  private detectType(buf: Buffer): DetectedType | null {
    if (buf.length < 12) return null;

    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      return 'image/png';
    }
    // GIF: "GIF87a" / "GIF89a"
    const gifTag = buf.toString('ascii', 0, 6);
    if (gifTag === 'GIF87a' || gifTag === 'GIF89a') {
      return 'image/gif';
    }
    // WEBP: "RIFF"...."WEBP"
    if (
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }
    // MP4 (and similar ISO-BMFF): bytes 4..8 == "ftyp"
    if (buf.toString('ascii', 4, 8) === 'ftyp') {
      return 'video/mp4';
    }
    // WEBM / Matroska: EBML header 1A 45 DF A3
    if (
      buf[0] === 0x1a &&
      buf[1] === 0x45 &&
      buf[2] === 0xdf &&
      buf[3] === 0xa3
    ) {
      return 'video/webm';
    }
    return null;
  }

  /**
   * Re-encode an image to the same format via sharp. sharp's decoder rejects
   * non-images and caps input pixels (decompression-bomb guard), and the
   * re-encode drops anything that isn't pixel data.
   */
  private async reencodeImage(
    buf: Buffer,
    type: DetectedType,
  ): Promise<Buffer> {
    try {
      // `animated: true` preserves multi-frame GIF/WEBP; harmless for stills.
      const pipeline = sharp(buf, { animated: true });
      switch (type) {
        case 'image/jpeg':
          return await pipeline.jpeg().toBuffer();
        case 'image/png':
          return await pipeline.png().toBuffer();
        case 'image/webp':
          return await pipeline.webp().toBuffer();
        case 'image/gif':
          return await pipeline.gif().toBuffer();
        default:
          return buf;
      }
    } catch {
      throw new BadRequestException('Invalid or corrupted image file');
    }
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

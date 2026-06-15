import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { S3Config } from '../../config/configuration';
import { StorageService } from './storage.service';

/**
 * Dev/default storage: writes to a local `uploads/` directory. In production the
 * compose file runs MinIO and this provider is swapped for an S3 implementation
 * (same StorageService contract). Public URLs are built from MEDIA_PUBLIC_URL so
 * the swap doesn't change the URLs clients receive.
 */
@Injectable()
export class LocalDiskStorageService extends StorageService {
  private readonly logger = new Logger(LocalDiskStorageService.name);
  private readonly root = resolve(process.cwd(), 'uploads');
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = config
      .getOrThrow<S3Config>('s3')
      .publicUrl.replace(/\/+$/, '');
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<string> {
    const filePath = join(this.root, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    this.logger.debug(`Stored ${key} (${body.length} bytes) on local disk`);
    return key;
  }

  async remove(key: string): Promise<void> {
    await rm(join(this.root, key), { force: true }).catch(() => undefined);
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key.replace(/^\/+/, '')}`;
  }
}

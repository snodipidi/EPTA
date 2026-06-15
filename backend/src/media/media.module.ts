import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalDiskStorageService } from './storage/local-disk-storage.service';
import { STORAGE_SERVICE } from './storage/storage.service';

/**
 * Media uploads. The storage backend is bound here behind STORAGE_SERVICE —
 * swap LocalDiskStorageService for an S3StorageService (MinIO/AWS) without
 * touching MediaService or any caller.
 */
@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    { provide: STORAGE_SERVICE, useClass: LocalDiskStorageService },
  ],
  exports: [MediaService],
})
export class MediaModule {}

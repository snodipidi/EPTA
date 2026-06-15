import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common';
import { MediaResponseDto } from './dto/media-response.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth('access-token')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  // Memory storage — buffer is handed to StorageService. 10 MiB hard cap at the
  // multer layer as a first line of defence before our own validation.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a media file (image/video)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: MediaResponseDto })
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MediaResponseDto> {
    return this.media.upload(userId, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      originalName: file.originalname,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media metadata (owner only)' })
  @ApiOkResponse({ type: MediaResponseDto })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaResponseDto> {
    return this.media.findOne(id, userId);
  }
}

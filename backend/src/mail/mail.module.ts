import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Mail feature module. Exports MailService so any feature (currently auth's
 * email verification) can send mail without knowing the transport.
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

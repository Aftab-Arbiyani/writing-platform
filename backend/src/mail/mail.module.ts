import { Global, Module } from '@nestjs/common';

import { MailService } from './mail.service';

/**
 * Transactional email infrastructure. Global — auth (and later notifications)
 * inject `MailService` without repeated imports.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

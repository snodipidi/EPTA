import { Global, Module } from '@nestjs/common';
import { PythonServiceClient } from './python/python-service.client';

/**
 * Outbound integrations with external (Python) services. Global so feeds,
 * moderation hooks, and queue processors can all inject PythonServiceClient.
 */
@Global()
@Module({
  providers: [PythonServiceClient],
  exports: [PythonServiceClient],
})
export class IntegrationsModule {}

import { Module } from '@nestjs/common';
import { VersioningService } from './versioning.service';

@Module({
  providers: [VersioningService],
  exports: [VersioningService],
})
export class VersioningModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageAdapter } from './local-storage.adapter';
import { R2StorageAdapter } from './r2-storage.adapter';
import { STORAGE } from './storage.interface';

@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('STORAGE_DRIVER') === 'r2'
          ? new R2StorageAdapter(config)
          : new LocalStorageAdapter(config),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}

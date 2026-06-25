import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { UPLOADS_DIR } from './storage/local-storage.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  app.use(cookieParser());
  if (config.get('STORAGE_DRIVER') !== 'r2') {
    app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' });
  }
  app.useGlobalFilters(new HttpExceptionFilter());
  app.set('trust proxy', 1);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}
bootstrap();

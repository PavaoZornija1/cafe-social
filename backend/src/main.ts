import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const redisUrl = configService.get<string>('REDIS_URL')?.trim();
  if (redisUrl) {
    const redisAdapter = new RedisIoAdapter(app, redisUrl);
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
    // eslint-disable-next-line no-console
    console.log('Socket.IO using Redis adapter');
  } else {
    app.useWebSocketAdapter(new IoAdapter(app));
  }
  const port = configService.get<number>('PORT') ?? 3005;

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Portal-Venue-Context',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Cafe Social backend is running on http://localhost:${port}/api`);
}

bootstrap();



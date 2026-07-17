import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis-io.adapter';
import { requireRedisGameRuntime } from './redis/game-runtime-policy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const redisUrl = configService.get<string>('REDIS_URL')?.trim();
  const runtimeEnv = {
    NODE_ENV: configService.get<string>('NODE_ENV'),
    REDIS_URL: redisUrl,
    GAME_RUNTIME_REQUIRE_REDIS: configService.get<string>(
      'GAME_RUNTIME_REQUIRE_REDIS',
    ),
    GAME_RUNTIME_ALLOW_MEMORY: configService.get<string>(
      'GAME_RUNTIME_ALLOW_MEMORY',
    ),
  };
  if (redisUrl) {
    const redisAdapter = new RedisIoAdapter(app, redisUrl);
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
    // eslint-disable-next-line no-console
    console.log('Socket.IO using Redis adapter');
  } else {
    if (requireRedisGameRuntime(runtimeEnv)) {
      throw new Error(
        'REDIS_URL is required for Socket.IO / game runtime (production or GAME_RUNTIME_REQUIRE_REDIS=1)',
      );
    }
    app.useWebSocketAdapter(new IoAdapter(app));
    // eslint-disable-next-line no-console
    console.warn(
      'Socket.IO using in-memory adapter — process-local only; set REDIS_URL for multi-pod fan-out',
    );
  }
  const port = Number(configService.get<string>('PORT') ?? '3005') || 3005;
  /** Listen on all interfaces so phones on the LAN can reach dev (not only 127.0.0.1). */
  const host = configService.get<string>('HOST')?.trim() || '0.0.0.0';

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

  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(
    `Cafe Social backend listening on http://${host}:${port}/api (use your Mac LAN IP from the phone, e.g. http://192.168.x.x:${port}/api)`,
  );
}

bootstrap();



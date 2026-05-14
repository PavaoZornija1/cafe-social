import { Global, Module } from '@nestjs/common';
import { GameRuntimeRedisService } from './game-runtime-redis.service';

@Global()
@Module({
  providers: [GameRuntimeRedisService],
  exports: [GameRuntimeRedisService],
})
export class RedisModule {}

import { registerAs } from '@nestjs/config'

export default registerAs('redis', () => ({
  sentinelHost1: process.env.REDIS_SENTINEL_HOST1 ?? 'redis-sentinel1',
  sentinelHost2: process.env.REDIS_SENTINEL_HOST2 ?? 'redis-sentinel2',
  sentinelHost3: process.env.REDIS_SENTINEL_HOST3 ?? 'redis-sentinel3',
  sentinelPort: process.env.REDIS_SENTINEL_PORT ? Number(process.env.REDIS_SENTINEL_PORT) : 26379,
  masterName: process.env.REDIS_MASTER_NAME ?? 'mymaster',
}))

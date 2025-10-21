import { Test } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'

import { AssetsModule } from '@/api/v2/assets/assets.module'
import * as config from '@/config'

export async function getAssetsTestingModule() {
  return await Test.createTestingModule({
    imports: [
      AssetsModule,
      ConfigModule.forRoot({
        isGlobal: true,
        load: Object.values(config),
      }),
    ],
  }).compile()
}

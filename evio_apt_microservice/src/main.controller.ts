import { Controller, Get } from '@nestjs/common'

@Controller()
export class MainController {
  @Get(['health', 'healthcheck', 'status', 'statuscheck'])
  healthCheck() {
    return 'OK' // more checks?
  }

  @Get('ping')
  ping() {
    return 'pong'
  }
}

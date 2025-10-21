import { Injectable, BadRequestException } from '@nestjs/common'

type Ctor<T = any> = new (...args: any[]) => T

@Injectable()
export class DtoRegistry {
  private map = new Map<string, Ctor>()

  register(strategy: string, useCase: string, dto: Ctor) {
    this.map.set(`${strategy}:${useCase}`, dto)
  }

  get(strategy: string, useCase: string): Ctor {
    const key = `${strategy}:${useCase}`
    const dto = this.map.get(key)
    if (!dto) throw new BadRequestException(`No DTO registered for ${key}`)
    return dto
  }
}

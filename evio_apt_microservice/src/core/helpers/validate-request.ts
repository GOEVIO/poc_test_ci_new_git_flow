import { BadRequestException } from '@nestjs/common'
import { validate } from 'class-validator'

export const validateRequest = async <T extends object>(instance: T) => {
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  })
  if (errors.length) {
    throw new BadRequestException({
      success: false,
      server_status_code: 'validation_failed',
      message: errors.flatMap((error) =>
        Object.values(error.constraints || {})
      ),
    })
  }
}

import { Expose } from 'class-transformer'
import { IsOptional, IsString, Matches } from 'class-validator'

export class StatusCodeDto {
  @IsString()
  @Matches(/^\d{3}$/)
  @Expose({ name: 'Code' })
  code: string

  @IsOptional()
  @IsString()
  @Expose({ name: 'Description' })
  description?: string | null

  @IsOptional()
  @IsString()
  @Expose({ name: 'AdditionalInfo' })
  info?: string | null
}

import { StatusCodeDto } from '@/shared/dto/status-code.dto'
import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class RemoteStartDto {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'evseId' })
  @ApiProperty({ example: 'DE*ICEE19DD01' })
  evseId: string

  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'contractId' })
  @ApiProperty({ example: 'PT-EVI-C80660650-M' })
  contractId: string

  @IsString()
  @Expose({ name: 'sessionId' })
  @ApiProperty({ example: '680111f5f05de8111cb26350' })
  sessionId: string
}

export class RemoteStopDto {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'evseId' })
  @ApiProperty({ example: 'DE*ICEE19DD01' })
  evseId: string

  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'sessionId' })
  @ApiProperty({ example: 'd16a6268-7f3d-4bb8-8c03-77002c5cca53' })
  sessionId: string
}

export class RemoteResultDto {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'Result' })
  result: boolean

  @Type(() => StatusCodeDto)
  @IsObject()
  @Expose({ name: 'StatusCode' })
  statusCode: StatusCodeDto

  @IsString()
  @IsOptional()
  @Expose({ name: 'SessionID' })
  sessionId?: string

  @IsString()
  @IsOptional()
  @Expose({ name: 'CPOPartnerSessionID' })
  cpoPartnerSessionId?: string

  @IsString()
  @IsOptional()
  @Expose({ name: 'EMPPartnerSessionID' })
  empPartnerSessionId?: string
}
export class RemoteResponseDto {
  @IsString()
  @IsNotEmpty()
  success: boolean

  @Type(() => StatusCodeDto)
  @IsObject()
  data: StatusCodeDto

  @IsString()
  @IsOptional()
  sessionId?: string
}

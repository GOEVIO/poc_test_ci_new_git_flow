import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'

import { AptService } from './apt.service'
import { ControllerResult } from 'src/common/result-wrappers'
import { BodyAptDto, CreateAptResponseDto } from './dtos/create-apt.dto'
import { GetAptResponseDto } from './dtos'
import { MockAptResultExample } from './tests/mocks/apt-result.example'
import { plainToInstance } from 'class-transformer'
import { GetAptGuard } from '../common/guard/get-apt.guard'

@Controller()
@ApiTags('APT')
export class AptController {
  constructor(private readonly aptService: AptService) {}

  /**
   * This endpoint is used to create a new apt.
   * 400 - Malformed body.
   * 500 - Unexpected error.
   * 201 - Success.
   * @param {BodyAptDto} body - the request body.
   * @return {ControllerResult} success message.
   * @throws {BadRequestException} on malformed body.
   * @throws {InternalServerErrorException} on unexpected error.
   */
  @ApiOperation({ summary: 'Create a new apt' })
  @ApiResponse({
    status: 201,
    description: 'Apt created successfully',
    type: CreateAptResponseDto,
    example: {
      success: true,
      message: 'Apt created successfully',
      data: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        serial_number: '000353535',
        user_id: '123e4567-e89b-12d3-a456-426614174000',
      },
    },
  })
  @Post()
  async create(
    @Body() body: BodyAptDto
  ): Promise<ControllerResult<CreateAptResponseDto | null>> {
    try {
      const data = await this.aptService.create(body)
      return {
        message: 'Apt created successfully',
        success: true,
        data,
      }
    } catch (error: any) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'APT not created',
        code:
          typeof error === 'object' && error !== null && 'response' in error
            ? (error as any)?.response?.code
            : 'apt_not_created',
      })
    }
  }

  /**
   * Retrieves all APT (Apartment) entities.
   *
   * @returns {Promise<ControllerResult<GetAptResponseDto[]>>} A promise that resolves to a controller result containing an array of APT response Dtos.
   * @throws {NotFoundException} If no APTs are found.
   * @throws {BadRequestException} If an error occurs during retrieval.
   */
  @ApiOperation({ summary: 'Get all APTs' })
  @ApiResponse({
    status: 200,
    description: 'APTs retrieved successfully',
    type: GetAptResponseDto,
    isArray: true,
    example: {
      success: true,
      message: 'APTs retrieved successfully',
      data: [MockAptResultExample],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No APTs found',
    example: {
      success: false,
      message: 'No APTs found',
      code: 'apt_not_found',
    },
  })
  @Get()
  async findAll(): Promise<ControllerResult<GetAptResponseDto[]>> {
    const data = await this.aptService.findAll(true)
    if (!data || data.length === 0) {
      throw new NotFoundException({
        message: 'No APTs found',
        code: 'apt_not_found',
      })
    }
    return {
      message: 'APTs retrieved successfully',
      success: true,
      data: plainToInstance(GetAptResponseDto, data, {
        enableCircularCheck: true,
        excludeExtraneousValues: true,
      }),
    }
  }

  /**
   * Retrieves an APT by its serial number.
   *
   * @param {string} serial_number - The serial number of the APT to retrieve.
   * @returns {Promise<ControllerResult<GetAptResponseDto | null>>} A promise that resolves to a controller result containing the APT response Dto.
   * @throws {NotFoundException} If the APT with the specified serial number is not found.
   */
  @ApiOperation({ summary: 'Get APT by serial number' })
  @ApiParam({
    name: 'serial_number',
    description: 'The serial number of the APT to retrieve',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'APT retrieved successfully',
    type: GetAptResponseDto,
    example: {
      success: true,
      message: 'APT retrieved successfully',
      data: MockAptResultExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'APT not found',
    example: {
      success: false,
      message: 'APT with serial number 000353535 not found',
      code: 'apt_not_found',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    example: {
      success: false,
      message: 'APT not found',
      code: 'apt_not_found',
    },
  })
  @Get(':serial_number')
  async findBySerialNumber(
    @Param('serial_number') serial_number: string
  ): Promise<ControllerResult<GetAptResponseDto | null>> {
    const data = await this.aptService.findBySerialNumber(serial_number, true)
    if (!data) {
      throw new NotFoundException({
        message: `APT with serial number ${serial_number} not found`,
        code: 'apt_not_found',
      })
    }
    return {
      message: 'APT retrieved successfully',
      success: true,
      data: plainToInstance(GetAptResponseDto, data, {
        enableCircularCheck: true,
        excludeExtraneousValues: true,
      }),
    }
  }

  /**
   * Create Route to update an APT by serial number.
   */
  @ApiOperation({ summary: 'Update APT by serial number' })
  @ApiParam({
    name: 'serial_number',
    description: 'The serial number of the APT to update',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'APT updated successfully',
    type: GetAptResponseDto,
    example: {
      success: true,
      message: 'APT updated successfully',
      data: MockAptResultExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'APT not found',
    example: {
      success: false,
      message: 'APT with serial number 000353535 not found',
      code: 'apt_not_found',
    },
  })
  @UseGuards(GetAptGuard)
  @Put(':serial_number')
  async updateBySerialNumber(
    @Param('serial_number') serial_number: string,
    @Body() body: BodyAptDto,
    @Req() request: Request
  ): Promise<ControllerResult<GetAptResponseDto | null>> {
    const apt = (request as Request & { apt?: any }).apt
    try {
      const updatedApt = await this.aptService.update(serial_number, body, apt)
      return {
        message: 'APT updated successfully',
        success: true,
        data: plainToInstance(GetAptResponseDto, updatedApt, {
          enableCircularCheck: true,
          excludeExtraneousValues: true,
        }),
      }
    } catch (error) {
      throw new BadRequestException({
        message: error instanceof Error ? error.message : 'APT not created',
        code:
          typeof error === 'object' && error !== null && 'response' in error
            ? (error as any)?.response?.code
            : 'apt_not_created',
      })
    }
  }

  @ApiOperation({ summary: 'Delete APT by serial number' })
  @ApiParam({
    name: 'serial_number',
    description: 'The serial number of the APT to delete',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'APT deleted successfully',
    example: {
      success: true,
      message: 'APT deleted successfully',
      data: null,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'APT not found',
    example: {
      success: false,
      message: 'APT with serial number 000353535 not found',
      code: 'apt_not_found',
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    example: {
      success: false,
      message: 'APT not deleted',
      code: 'apt_not_deleted',
    },
  })
  @UseGuards(GetAptGuard)
  @Delete(':serial_number')
  async deleteBySerialNumber(
    @Param('serial_number') serial_number: string,
    @Req() request: Request
  ): Promise<ControllerResult<null>> {
    const apt = (request as Request & { apt?: any }).apt

    await this.aptService.delete(serial_number, apt)
    return {
      message: 'APT deleted successfully',
      success: true,
      data: null,
    }
  }
}

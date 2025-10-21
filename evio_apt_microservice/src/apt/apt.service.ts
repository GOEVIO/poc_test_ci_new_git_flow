import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { AptRepository } from './apt.repository'
import { BodyAptDto, CreateAptResponseDto } from './dtos'
import { plainToInstance } from 'class-transformer'
import { Apt } from '../database/entities/apt.entity'
import { UUID } from 'crypto'

import { ChargersService } from '../chargers/services/common/charger.service'
import { IdentityLibraryService } from '../libraries/identity-library.service'

@Injectable()
export class AptService {
  constructor(
    private readonly aptRepository: AptRepository,
    private readonly identityLibraryService: IdentityLibraryService,
    private readonly chargersService: ChargersService
  ) {}
  async create(aptData: BodyAptDto): Promise<CreateAptResponseDto> {
    const aptAlreadyExists = await this.findBySerialNumber(
      aptData.serial_number
    )
    if (aptAlreadyExists) {
      throw new BadRequestException({
        message: `APT with serial number ${aptData.serial_number} already exists`,
        code: 'apt_already_exists',
      })
    }

    const aptUser = await this.identityLibraryService.create({
      serial_number: aptData.serial_number,
      model: aptData.model,
      client_name: aptData.client_name || 'EVIO',
    })
    if (!aptUser || !aptUser.user_id) {
      throw new BadRequestException({
        message: 'Failed to create APT user',
        code: 'apt_user_not_created',
      })
    }

    try {
      const [isUserCreateValid, isOwnerValid] = await Promise.all([
        this.identityLibraryService.verifyUserExists(aptData.create_user_id),
        this.identityLibraryService.verifyUserExists(aptData.apt_owner_id),
      ])

      if (!isUserCreateValid) {
        throw new BadRequestException({
          message: 'Failed to create APT, create user not validated',
          code: 'apt_user_not_validated',
        })
      }

      if (!isOwnerValid) {
        throw new BadRequestException({
          message: 'Failed to create APT, owner user not validated',
          code: 'apt_owner_not_validated',
        })
      }

      let aptChargers = undefined
      if (aptData.chargers && aptData.chargers.length > 0) {
        aptChargers = await this.chargersService.createMany(aptData.chargers)
      }

      const created = await this.aptRepository.insert({
        ...aptData,
        chargers: aptChargers,
        user_id: aptUser.user_id,
        number_of_chargers: aptData.chargers?.length || 0,
      })
      return plainToInstance(CreateAptResponseDto, created, {
        excludeExtraneousValues: true,
      })
    } catch (error) {
      if (aptUser.user_id) {
        await this.identityLibraryService.delete(aptUser.user_id)
      }
      if (error instanceof BadRequestException) {
        throw new BadRequestException({
          message: error.message,
          code:
            (typeof error.getResponse === 'function' &&
              (error.getResponse() as any).code) ||
            'apt_bad_request',
        })
      }
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT not created',
        code: 'apt_not_created',
      })
    }
  }

  async findBySerialNumber(
    serial_number: string,
    withRelation = false
  ): Promise<Apt | null> {
    try {
      return await this.aptRepository.findBySerialNumber(
        serial_number,
        withRelation
      )
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT not found',
        code: 'apt_not_found',
      })
    }
  }

  async findById(id: UUID, withRelation = false): Promise<Apt | null> {
    try {
      return await this.aptRepository.findById(id, withRelation)
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT not found',
        code: 'apt_not_found',
      })
    }
  }

  async findAll(withRelation = false): Promise<Apt[]> {
    try {
      return await this.aptRepository.findAll(withRelation)
    } catch (error: any) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APTs not found',
        code: 'apt_not_found',
        success: false,
      })
    }
  }

  async update(
    serial_number: string,
    body: BodyAptDto,
    apt: Apt
  ): Promise<Apt | null> {
    if (body.create_user_id !== apt.create_user_id) {
      const isUserCreateValid =
        await this.identityLibraryService.verifyUserExists(body.create_user_id)
      if (!isUserCreateValid) {
        throw new BadRequestException({
          message: 'Failed to update APT, create user not validated',
          code: 'apt_user_not_validated',
        })
      }
    }
    if (body.apt_owner_id !== apt.apt_owner_id) {
      const isOwnerValid = await this.identityLibraryService.verifyUserExists(
        body.apt_owner_id
      )
      if (!isOwnerValid) {
        throw new BadRequestException({
          message: 'Failed to update APT, owner user not validated',
          code: 'apt_owner_not_validated',
        })
      }
    }

    await this.chargersService.updateManyByHwId(
      body?.chargers?.map((charger) => charger.hwId) || [],
      body?.chargers || [],
      apt.id as UUID
    )
    try {
      const number_of_chargers = apt.chargers?.length || 0
      delete body.chargers
      return this.aptRepository.update(serial_number, {
        ...body,
        number_of_chargers,
      })
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT not updated',
        code: 'apt_not_updated',
        success: false,
      })
    }
  }

  async delete(serial_number: string, apt: Apt): Promise<void> {
    try {
      await Promise.all([
        this.aptRepository.delete(serial_number),
        this.identityLibraryService.delete(apt.user_id),
      ])
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT not deleted',
        code: 'apt_not_deleted',
        success: false,
      })
    }
  }
}

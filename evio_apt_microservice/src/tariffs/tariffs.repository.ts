import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository as TypeORMRepository } from 'typeorm'
import { DataSource } from 'typeorm'
import {
  AptTariffElements,
  AptTariffPriceComponents,
  AptTariffRestrictions,
  AptTariffsDetails,
} from '../database/entities'
import {
  CreateTariffDto,
  TariffDetailsDto,
  UpdateTariffDto,
} from './tariffs.dto'
import { DeviceTypes, isNotEmptyObject } from 'evio-library-commons'
import { UUID } from 'crypto'

@Injectable()
export class TariffsRepository {
  private fullRelations = {
    elements: {
      restrictions: true,
      price_components: true,
    },
  }
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AptTariffsDetails)
    private readonly tariffsDetailsRepository: TypeORMRepository<AptTariffsDetails>,
    @InjectRepository(AptTariffElements)
    private readonly tariffElementsRepository: TypeORMRepository<AptTariffElements>,
    @InjectRepository(AptTariffRestrictions)
    private readonly tariffElementsRestrictionsRepository: TypeORMRepository<AptTariffRestrictions>,
    @InjectRepository(AptTariffPriceComponents)
    private readonly tariffPriceComponentsRepository: TypeORMRepository<AptTariffPriceComponents>
  ) {}

  async insertTariffs({
    details,
  }: CreateTariffDto): Promise<AptTariffsDetails | null> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tariffsDetailsRepo = manager.withRepository(
          this.tariffsDetailsRepository
        )
        const elementsRepo = manager.withRepository(
          this.tariffElementsRepository
        )
        const restrictionsRepo = manager.withRepository(
          this.tariffElementsRestrictionsRepository
        )
        const priceComponentsRepo = manager.withRepository(
          this.tariffPriceComponentsRepository
        )

        const tariffDetail = await tariffsDetailsRepo.save(details)
        if (!tariffDetail?.id)
          throw new Error('Tariff detail could not be created')

        const { elements = [] } = details

        for (const element of elements) {
          const createdElement = await elementsRepo.save({
            ...element,
            detail: tariffDetail,
          })
          if (!createdElement?.id)
            throw new Error('Error during tariff element creation')

          const { price_components = [], restrictions = null } = element

          if (restrictions && isNotEmptyObject(restrictions)) {
            const restrictionsCreated = await restrictionsRepo.save({
              ...restrictions,
              element: createdElement,
            })
            if (!restrictionsCreated?.id)
              throw new Error(
                'Error during tariff element restrictions creation'
              )
          }

          for (const component of price_components) {
            const componentCreated = await priceComponentsRepo.save({
              ...component,
              element: createdElement,
            })
            if (!componentCreated?.id) {
              throw new Error(
                'Tariff element price component could not be created'
              )
            }
          }
        }

        return tariffsDetailsRepo.findOne({
          where: { id: tariffDetail.id },
          relations: this.fullRelations,
        })
      })
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Tariff not created',
        code: 'tariff_not_created',
      })
    }
  }

  async updateTariffs(
    id: string,
    { details }: UpdateTariffDto
  ): Promise<TariffDetailsDto | null> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tariffsDetailsRepo = manager.withRepository(
          this.tariffsDetailsRepository
        )
        const elementsRepo = manager.withRepository(
          this.tariffElementsRepository
        )
        const restrictionsRepo = manager.withRepository(
          this.tariffElementsRestrictionsRepository
        )
        const priceComponentsRepo = manager.withRepository(
          this.tariffPriceComponentsRepository
        )

        const tariffDetail = await tariffsDetailsRepo.findOne({
          where: { id: id as UUID },
          relations: this.fullRelations,
        })

        if (!tariffDetail) throw new Error('Tariff detail not found')

        Object.assign(tariffDetail, { ...details })
        if (!tariffDetail.elements) {
          tariffDetail.elements = []
        }

        const incomingElements = details?.elements || []

        for (const incomingElement of incomingElements) {
          let elementEntity = tariffDetail.elements.find(
            (e) => e.id === incomingElement.id
          )

          if (elementEntity) {
            Object.assign(elementEntity, {
              ...incomingElement,
              detail: tariffDetail,
            })
          } else {
            elementEntity = elementsRepo.create({
              ...incomingElement,
              detail: tariffDetail,
            })
            tariffDetail.elements.push(elementEntity)
          }
          await elementsRepo.save(elementEntity)

          if (
            incomingElement.restrictions &&
            Object.keys(incomingElement.restrictions).length
          ) {
            let restrictionEntity = elementEntity.restrictions

            if (restrictionEntity) {
              Object.assign(restrictionEntity, {
                ...incomingElement.restrictions,
                element: elementEntity,
              })
            } else {
              restrictionEntity = restrictionsRepo.create({
                ...incomingElement.restrictions,
                element: elementEntity,
              })
              elementEntity.restrictions = restrictionEntity
            }

            await restrictionsRepo.save(restrictionEntity)
          }

          const incomingComponents = incomingElement.price_components || []
          elementEntity.price_components = elementEntity.price_components || []

          for (const incomingComponent of incomingComponents) {
            let componentEntity = elementEntity.price_components.find(
              (pc) => pc.id === incomingComponent.id
            )

            if (componentEntity) {
              Object.assign(componentEntity, {
                ...incomingComponent,
                element: elementEntity,
              })
            } else {
              componentEntity = priceComponentsRepo.create({
                ...incomingComponent,
                element: elementEntity,
              })
              elementEntity.price_components.push(componentEntity)
            }

            await priceComponentsRepo.save(componentEntity)
          }
        }

        await tariffsDetailsRepo.save(tariffDetail)

        return tariffsDetailsRepo.findOne({
          where: { id: id as UUID },
          relations: this.fullRelations,
        })
      })
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Tariff not updated',
        code: 'tariff_not_updated',
      })
    }
  }

  async deleteTariffs(id: string): Promise<boolean> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const tariffsDetailsRepo = manager.withRepository(
          this.tariffsDetailsRepository
        )

        const tariffDetail = await tariffsDetailsRepo.findOne({
          where: { id: id as UUID },
          relations: { elements: true },
        })
        if (!tariffDetail) throw new Error('Tariff detail not found')

        await tariffsDetailsRepo.remove(tariffDetail)
      })
      return true
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Tariff not deleted',
        code: 'tariff_not_deleted',
      })
    }
  }

  async findTariffById(id: string): Promise<TariffDetailsDto | null> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tariffsDetailsRepo = manager.withRepository(
          this.tariffsDetailsRepository
        )

        const tariffDetail = await tariffsDetailsRepo.findOne({
          where: { id: id as UUID },
          relations: this.fullRelations,
        })
        if (!tariffDetail) throw new Error('Tariff not found')

        return tariffDetail
      })
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Tariff not found',
        code: 'tariff_not_found',
      })
    }
  }

  async findTariffByPlugId(
    plug_id: string,
    device: DeviceTypes
  ): Promise<TariffDetailsDto[] | null> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tariffsDetailsRepo = manager.withRepository(
          this.tariffsDetailsRepository
        )

        const tariffDetail = await tariffsDetailsRepo.find({
          where: { plug_id: plug_id as UUID, auth_type: device },
          relations: this.fullRelations,
        })
        if (!tariffDetail) throw new Error('Tariff not found')

        return tariffDetail
      })
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'Tariff not found',
        code: 'tariff_not_found',
      })
    }
  }
}

import { PaginationDto } from '@/shared/pagination/pagination.dto'
import { ClientTypeType } from '@/shared/types/client-type.type'
import { YesNoDash } from '@/shared/types/yes-no-dash.type'

export class OverviewDataDto {
  createdAt: string
  licensePlate: string
  costumerName: string
  costumerNif?: string
  costumerEmail: string
  clientName: string
  clientType: ClientTypeType
  B2B2C: YesNoDash
  assetType: string
  active: boolean
}

export class OverviewFiltersDto {
  public dateFrom?: string
  public dateThru?: string
  public clientType?: ClientTypeType
  public createUser?: string

  constructor(
    dateFrom?: Date,
    dateThru?: Date,
    clientType?: ClientTypeType,
    createUser?: string,
  ) {
    if (dateFrom) {
      this.dateFrom = String(dateFrom)
    }
    if (dateThru) {
      this.dateThru = String(dateThru)
    }
    if (clientType) {
      this.clientType = clientType
    }
    if (createUser) {
      this.createUser = createUser
    }
  }
}

export class OverviewDto {
  public total: number
  constructor(
    public data: OverviewDataDto[],
    public pagination: PaginationDto,
    public filters: OverviewFiltersDto,
  ) {
    this.total = data.length
  }
}

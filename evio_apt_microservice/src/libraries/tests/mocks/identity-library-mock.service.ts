import { Injectable } from '@nestjs/common'

@Injectable()
export class IdentityLibraryMockService {
  create = jest.fn()
  delete = jest.fn()
  aptUser = jest.fn().mockReturnValue({
    active: true,
    status: 'REGISTERED',
    validated: false,
    accountDeletionRequested: false,
    licenseAgreement: true,
    licenseMarketing: true,
    licenseServices: true,
    licenseProducts: true,
    country: 'PT',
    language: 'pt_PT',
    internationalPrefix: '+351',
    imageContent: '',
    accessType: 'limited',
    clientType: 'APT',
    devUser: false,
    blocked: false,
    paymentPeriod: 'APT-NA',
    needChangePassword: false,
    isBankTransferEnabled: false,
    isMBRefEnabled: false,
    changedEmail: false,
    clientName: 'EVIO',
    userType: 'APT-NA',
    activePartner: false,
    cardAndMemberNotValid: false,
    faildConnectionACP: false,
    userIds: [],
    username: 'APT-PT',
    mobile: 'APT-PT',
    email: 'APT-PT',
    name: 'APT-PT',
    deletionClearance: [],
    createDate: new Date(),
    favorites: [],
    referencePlaces: [],
    clientList: [],
  })
}

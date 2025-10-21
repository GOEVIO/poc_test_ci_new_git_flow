import { Injectable, InternalServerErrorException } from '@nestjs/common'
import {
  insertUser,
  IUser,
  deleteUser,
  findUserById,
} from 'evio-library-identity'

interface IAptDataToCreateUser {
  serial_number: string
  model: string
  client_name: string
}

@Injectable()
export class IdentityLibraryService {
  // eslint-disable-next-line max-lines-per-function
  aptUser({ model, serial_number, client_name }: IAptDataToCreateUser): IUser {
    return {
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
      clientName: client_name || 'EVIO',
      userType: 'APT-NA',
      activePartner: false,
      cardAndMemberNotValid: false,
      faildConnectionACP: false,
      userIds: [],
      username: serial_number,
      mobile: serial_number,
      email: `APT-${model}-${serial_number}`,
      name: `APT-${model}-${serial_number}`,
      deletionClearance: [],
      createDate: new Date(),
      favorites: [],
      referencePlaces: [],
      clientList: [],
    }
  }

  async create(aptData: IAptDataToCreateUser): Promise<{ user_id: string }> {
    try {
      const userInfo = await insertUser(this.aptUser(aptData))
      if (!userInfo) {
        throw new Error('User not created')
      }
      return { user_id: userInfo?.insertedId.toString() }
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'APT user not created',
        code: 'user_not_created',
      })
    }
  }

  async delete(user_id: string): Promise<void> {
    try {
      await deleteUser(user_id)
    } catch (error) {
      throw new InternalServerErrorException({
        message:
          error instanceof Error ? error.message : 'APT user not deleted',
        code: 'unexpected_error',
      })
    }
  }

  async getUserById(
    user_id: string,
    projection = {}
  ): Promise<Partial<IUser> | null> {
    try {
      const user = await findUserById(user_id, projection)
      return user || null
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT user not found',
        code: 'user_not_found',
      })
    }
  }

  async verifyUserExists(user_id: string): Promise<boolean> {
    try {
      const user = await this.getUserById(user_id, { email: 1 })
      return !!user?.email
    } catch (error) {
      throw new InternalServerErrorException({
        message: error instanceof Error ? error.message : 'APT user not found',
        code: 'user_not_found',
      })
    }
  }
}

import Payment from 'evio-library-payments'

export class PaymentsLibraryRepository {
  async findPreAuthorizationById(id: string): Promise<any> {
    return Payment.retrievePreAuthorizationById(id)
  }

  async updatePreAuthorizationById(id: string, data: any): Promise<any> {
    return Payment.updatePreAuthorizationById(id, data)
  }

  async findPreAuthorizationByPSPReference(
    pspReference: string,
    projection = {}
  ): Promise<any> {
    return Payment.retrievePreAuthorizationByPSPReference(
      pspReference,
      projection
    )
  }

  async retrievePreAuthorizationByQuery(
    query: any,
    projection: any
  ): Promise<any> {
    return Payment.retrievePreAuthorizationByQuery(query, projection)
  }

  async updatePreAuthorizationByPSPReference(
    query: any,
    setData: any
  ): Promise<any> {
    return Payment.updatePreAuthorizationByPSPReference(query, setData)
  }
}

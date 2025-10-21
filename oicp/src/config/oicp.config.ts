import { registerAs } from '@nestjs/config'

export default registerAs('oicp', () => {
  const providerId = process.env.OICP_PROVIDER_ID as string
  const aditionalCountries = process.env.OICP_ADITIONAL_COUNTRIES as string ?? ''
  return {
    providerId,
    aditionalCountries,
    endpoints: {
      evse: {
        data: `/evsepull/v23/providers/${providerId}/data-records`,
        status: `/evsepull/v21/providers/${providerId}/status-records`,
        statusById : `/evsepull/v21/providers/${providerId}/status-records-by-id`,
        statusByOperatorId : `/evsepull/v21/providers/${providerId}/status-records-by-operator-id`,
      },
      charging: {
        remoteStart: `/charging/v21/providers/${providerId}/authorize-remote/start`,
        remoteStop: `/charging/v21/providers/${providerId}/authorize-remote/stop`,
      },
      tariff : {
        pricingProductData : `/dynamicpricing/v10/providers/${providerId}/pricing-products`,
        evsePricing : `/dynamicpricing/v10/providers/${providerId}/evse-pricing`
      },
      cdr : {
        get : `/cdrmgmt/v22/providers/${providerId}/get-charge-detail-records-request`
      }
    },
  }
})

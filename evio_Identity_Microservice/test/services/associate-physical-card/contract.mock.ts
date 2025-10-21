import env from '../../../constants/env'

const INACTIVE = env.networkStatus.NetworkStatusInactive
const ACTIVE = env.networkStatus.NetworkStatusActive
const APP_USER = env.tokensTypes.AppUser
const OTHER = env.tokensTypes.Other

const baseToken = {
  tokenType: APP_USER,
  status: ACTIVE,
  idTagDec: 'tag1',
  idTagHexa: 'tag2',
  idTagHexaInv: 'tag3',
}

const evioNetwork = {
  network: env.networks.EVIO,
  tokens: [{...baseToken}]
}

const mobieNetwork = {
  network: env.networks.MobiE,
  tokens: [{...baseToken}]
}

const gireveNetwork = {
  network: env.networks.Gireve,
  tokens: [{...baseToken, tokenType: OTHER}]
}

export const baseContract = {
  _id: Math.random().toString(),
  userId: Math.random().toString(),
  evId: Math.random().toString(),
  cardNumber: 'cardNumber',
  contractIdInternationalNetwork: [gireveNetwork],
  networks: [evioNetwork, mobieNetwork, gireveNetwork],
  clientName: 'clientName',
}

export const inactiveTokenContract = {
  ...baseContract,
  networks: [
    mobieNetwork,
    gireveNetwork,
    {
      ...evioNetwork,
      tokens: [{...baseToken, status: INACTIVE}]
    }
  ]
}

export const scContract = {
  ...baseContract,
  clientName: env.clientNames.SC
}

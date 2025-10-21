import env from '../../../constants/env'

const INACTIVE = env.networkStatus.NetworkStatusInactive
const ACTIVE = env.networkStatus.NetworkStatusActive

const baseRfidToken = {
  tokenType: env.tokensTypes.RFID,
  status: ACTIVE,
  idTagDec: 'tag1',
  idTagHexa: 'tag2',
  idTagHexaInv: 'tag3',
}

const evioNetwork = {
  network: env.networks.EVIO,
  tokens: [{...baseRfidToken}]
}

const mobieNetwork = {
  network: env.networks.MobiE,
  tokens: [{...baseRfidToken}]
}

const gireveNetwork = {
  network: env.networks.Gireve,
  tokens: [{...baseRfidToken}]
}

export const baseContract = {
  _id: Math.random().toString(),
  userId: Math.random().toString(),
  evId: Math.random().toString(),
  cardNumber: 'cardNumber',
  networks: [evioNetwork, mobieNetwork, gireveNetwork],
  clientName: 'clientName',
}

export const invalidTokenContract = {
  ...baseContract,
  networks: [
    mobieNetwork,
    gireveNetwork,
    {
      ...evioNetwork,
      tokens: [{...baseRfidToken, status: INACTIVE}]
    }
  ]
}

export const scContract = {
  ...baseContract,
  clientName: env.clientNames.SC
}

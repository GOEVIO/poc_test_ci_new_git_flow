import { ChargerNetworks, TokenTypes, ContractStatus, fieldEquals, get } from 'evio-library-commons'
import { updateNetworkStatus } from 'evio-library-assets'

import { findNetwork, ensureIdTagDec } from './activate-network-fleet'
import Contract from '../models/contracts'

const DEFAULT_TOKEN_TYPES = [TokenTypes.AppUser, TokenTypes.Other]
const DEFAULT_NETWORKS = [ChargerNetworks.Gireve, ChargerNetworks.Mobie]

function ensureIdTagDecForNetworks(networks:any, networkNames:string[], tokenTypes:string[]) {
  const evioNetwork = findNetwork(networks, ChargerNetworks.Evio)
  networks.filter(({network}) => networkNames.includes(network))
    .forEach((network) => ensureIdTagDec({
      tokenTypes,
      evioNetwork,
      updateNetwork: network,
    }))
}

type UpdateTokensStatusParams = {
  contract: any,
  action: 'ACTIVATE' | 'DEACTIVATE',
  networkNames?: string[],
  tokenTypes?: string[],
  path?: string,
  reason?: string,

}

async function updateTokensStatus({
  contract, action, networkNames, tokenTypes, path, reason,
}: UpdateTokensStatusParams) {
  await updateNetworkStatus({
    contractId: String(contract._id),
    userId: contract.userId,
    assetId: contract.evId,
    action,
    tokenTypes,
    networks: networkNames,
    path,
    reason
  })
}

type CreateNetworksTokensParams = {
  contract: any
  networkNames?: string[]
  tokenTypes?: string[]
  path?: string
}

/**
 * Creates the tokens of networks for a contract.
 * Defaults to virtual tokens for Mobie and Gireve.
 * Returns the same contract.
 */
async function createNetworksTokens({
  contract,
  networkNames = DEFAULT_NETWORKS,
  tokenTypes = DEFAULT_TOKEN_TYPES,
  path,
}: CreateNetworksTokensParams): Promise<void> {
  try {
    ensureIdTagDecForNetworks(contract.networks, networkNames, tokenTypes)

    await Contract.updateOne(
      { _id: contract._id },
      { $set: {
        networks: contract.networks,
      } }
    )

    await updateTokensStatus({
      contract,
      action: 'ACTIVATE',
      tokenTypes,
      networkNames,
      path,
    })

    return contract
  } catch (e) {
    console.error(`[createNetworkTokens] Error creating tokens for contract ${contract._id}:`, e)
    throw new Error(`[createNetworkTokens] Failed to create tokens: ${e.message}`)
  }
}

async function rollback(contracts: any[], path: string) {
  await Promise.all(contracts.map((contract) => updateTokensStatus({
    contract,
    action: 'DEACTIVATE',
    tokenTypes: DEFAULT_TOKEN_TYPES,
    networkNames: DEFAULT_NETWORKS,
    path,
    reason: 'rollback'
  })))

  throw new Error(`Successfully rolled back contracts ${contracts.map(c => String(c._id))}`)
}

type ActivateNetworksForVirtualUserContractParams = {
  contract: any
  path?: string
}

/**
 * Activate networks for user and ev contracts.
 * Activates Mobie and Gireve networks for newly created user contract.
 * Activates same networks for other contracts of the same user, probably ev/fleet contracts.
 */
export async function activateNetworksForVirtualUserContract({
  contract,
  path = 'POST /api/private/contracts',
}: ActivateNetworksForVirtualUserContractParams) {
  try {
    await createNetworksTokens({
      contract,
      networkNames: DEFAULT_NETWORKS,
      tokenTypes: DEFAULT_TOKEN_TYPES,
      path,
    })

    const otherContracts = await Contract.find({
      userId: contract.userId,
      _id: { $ne: contract._id },
      status: ContractStatus.Active,
    }).lean()

    const result: any[] = await Promise.allSettled(otherContracts.map(
      (otherContract) => createNetworksTokens({
        contract: otherContract,
        networkNames: DEFAULT_NETWORKS,
        tokenTypes: DEFAULT_TOKEN_TYPES,
        path,
      })
    ))

    if (result.some(fieldEquals('status', 'rejected'))) {
      await rollback(
        [contract, ...result.filter(fieldEquals('status', 'fulfilled')).map(get('value'))],
        path
      )
    }

  } catch (e) {
    console.error(`[activateNetworksForVirtualUserContract] Error activating networks for contract ${contract._id}:`, e?.message)
    throw new Error(`[activateNetworksForVirtualUserContract] Failed to activate networks: ${e?.message}`)
  }
}

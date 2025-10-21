import { updateNetworkStatus } from 'evio-library-assets'
import {
    TokenTypes, ChargerNetworks,
    fieldEquals
} from 'evio-library-commons'

import Contract from '../models/contracts'
import TokenStatusService from '../services/tokenStatus.service';
import toggle from 'evio-toggle';
import { deleteCachedContractsByUser } from './contracts'

const APP_USER = TokenTypes.AppUser
const RFID = TokenTypes.RFID
const OTHER = TokenTypes.Other
const EVIO = ChargerNetworks.Evio
const MOBIE = ChargerNetworks.Mobie
const GIREVE = ChargerNetworks.Gireve
const GO_CHARGE = ChargerNetworks.GoCharge
const HYUNDAI = ChargerNetworks.Hyundai
const KLC = ChargerNetworks.Klc
const KINTO = ChargerNetworks.Kinto

export type ActivateNetworkFleetParams = {
  fleetContract: any
  userContract: any
  networkName: string
  path: string
}

export type ActivateNetworksFleetParams = {
  fleetContract: any
  userContract: any
  networkNames: string[]
  path: string
}

function getNetworkNames(networkName): string[] {
    if (networkName === EVIO) {
        return [EVIO, GO_CHARGE, HYUNDAI, KLC, KINTO]
    }
    return [String(networkName)]
}

function getAnyIdTag(token) {
    return token.idTagDec
    || token.idTagHexa
    || token.idTagHexaInv
}

const setIdTagDecForMobie = (evioNetwork) => (mobieToken): void => {
    mobieToken.idTagDec = getAnyIdTag(mobieToken)
        || getAnyIdTag(
            evioNetwork.tokens.find(fieldEquals('tokenType', mobieToken.tokenType))
        )
}

const setIdTagDec = (evioNetwork) => (token): void => {
    const evioToken = evioNetwork.tokens.find(
        ({tokenType}) => tokenType === (
            token.tokenType === OTHER
            ? APP_USER // Other only exists for gireve, these cases we default with app_user
            : token.tokenType
        )
    )
    token.idTagDec = evioToken.idTagDec
}

export type EnsureIdTagDecParams = {
    tokenTypes: string[],
    evioNetwork: any,
    updateNetwork: any,
}

/**
 * Receives a network to update and the evio network of the same contract,
 * and an array of token types to update.
 * It ensures that the idTagDec is set for each token type in the update network.
 * For each token type, if the idTagDec is not set, it will try to get any tag
 * from the same network, if there isn't any, it will try to get any tag from
 * the evio network.
 * There's no default case for tags missing in both networks.
 * @param tokenTypes - Array of token types to update.
 * @param updateNetwork - The network to update.
 * @param evioNetwork - The evio network of the same contract.
 * @returns {void}
 */
export function ensureIdTagDec({
    tokenTypes, evioNetwork, updateNetwork
}: EnsureIdTagDecParams): void {
    updateNetwork.tokens
        .filter(({tokenType}) => tokenTypes.includes(tokenType))
        .filter(({idTagDec}) => !idTagDec)
        .forEach(updateNetwork.network === MOBIE
            ? setIdTagDecForMobie(evioNetwork)
            : setIdTagDec(evioNetwork)
        )
}

function updateMobieNetworkPaymentMethodFromUserContract(mobieNetwork, userContract) {
    mobieNetwork.paymentMethod = userContract.networks
        .find(fieldEquals('network', MOBIE))
        .paymentMethod || ''
}

function updateGireveIdTags(gireveNetwork, evioNetwork, tokenNames) {
    const evioAppUser = evioNetwork.tokens.find(fieldEquals('tokenType', APP_USER))
    const gireveOther = gireveNetwork.tokens.find(fieldEquals('tokenType', OTHER))

    gireveOther.idTagDec = gireveOther.idTagDec || evioAppUser.idTagDec

    if (tokenNames.includes(RFID) && gireveNetwork.tokens.some(fieldEquals('tokenType', RFID))) {
        const evioRfid = evioNetwork.tokens.find(fieldEquals('tokenType', RFID))
        const gireveRfid = gireveNetwork.tokens.find(fieldEquals('tokenType', RFID))

        gireveRfid.idTagDec = gireveRfid.idTagDec || evioRfid.idTagDec
        gireveRfid.idTagHexa = gireveRfid.idTagHexa || evioRfid.idTagHexa
        gireveRfid.idTagHexaInv = gireveRfid.idTagHexaInv || evioRfid.idTagHexaInv
    }
}

function addInternationalNetworkRfid(contract) {
    const gireveInternationalNetwork = contract.contractIdInternationalNetwork
        .find(fieldEquals('network', GIREVE))

    if (!gireveInternationalNetwork.tokens.some(fieldEquals('tokenType', RFID))) {
        gireveInternationalNetwork.tokens.push({tokenType: RFID})
    }
}

async function updateContractBeforeDispatchToken(updateContract, userContract, networkNames) {
    const update = {
        networks: updateContract.networks,
        contractIdInternationalNetwork: updateContract.contractIdInternationalNetwork,
        ...networkNames.includes(MOBIE)
            ? {
                address: userContract.address,
                nif: userContract.nif,
                contract_id: userContract.contract_id,
            }
            : {}
    }

    await Contract.updateOne(
        { _id: updateContract._id },
        { $set: update }
    )
}

async function applyUpdatesBeforeActivation({
    fleetContract, userContract, evioNetwork,
    tokenTypes, networks, networkNames
}) {
    networks
        .filter(({network}) => network !== EVIO)
        .forEach((network) => ensureIdTagDec({
            tokenTypes,
            evioNetwork,
            updateNetwork: network,
        }))

    const mobieNetwork = findNetwork(networks, MOBIE)
    if (mobieNetwork) {
        updateMobieNetworkPaymentMethodFromUserContract(
            mobieNetwork,
            userContract
        )
    }
    const gireveNetwork = findNetwork(networks, GIREVE)
    if (gireveNetwork) {
        updateGireveIdTags(
            gireveNetwork,
            evioNetwork,
            tokenTypes
        )
        if (gireveNetwork.tokens.some(fieldEquals('tokenType', RFID))) {
            addInternationalNetworkRfid(fleetContract)
        }
    }

    await updateContractBeforeDispatchToken(fleetContract, userContract, networkNames)
}

/**
 * Finds a network by name.
 * @param networks - Array of networks to search (from a contract).
 * @param networkName - Name of the network to find.
 * @returns The found network or undefined if not found.
 */
export function findNetwork(networks: any[], networkName: string): any {
    return networks.find(fieldEquals('network', networkName))
}

/**
 * Activates networks for a fleet contract
 * Updates fleetContract in database
 * @returns {Promise<any>} updated contract
 */
export async function activateNetworksFleet({
  fleetContract, userContract, networkNames, path
}: ActivateNetworksFleetParams): Promise<any> {
    try {
        const evioNetwork = findNetwork(fleetContract.networks, EVIO)
        const updateNetworks = fleetContract.networks.filter(({network}) => networkNames.includes(network))
        const tokenTypes = [ OTHER , APP_USER, RFID]

        await applyUpdatesBeforeActivation({
            fleetContract, userContract, evioNetwork,
            tokenTypes, networks: updateNetworks, networkNames
        })

        const featureFlagEnabled = await toggle.isEnable('fleet-363-deactivate-and-activate-network');
        console.log(`[activateNetworkFleet][featureFlagEnabled-fleet-363]: ${featureFlagEnabled}`);
        if (featureFlagEnabled) {
            const tokenStatusService = new TokenStatusService();
            return await tokenStatusService.switchBlockNetwork({ 
                contractId: String(fleetContract._id), 
                networkNames,
                activeBlock: false,
                requestUserId: String(fleetContract.userId),
                path: 'PATCH /api/private/contracts/activeNetwork'
            });
        }

        await updateNetworkStatus({
            contractId: String(fleetContract._id),
            userId: fleetContract.userId,
            assetId: fleetContract.evId || '-1',
            networks: networkNames,
            action: 'ACTIVATE',
            tokenTypes,
            path,
        })

        const updatedContract = await Contract.findOne({_id: fleetContract._id}).lean()

        await deleteCachedContractsByUser(fleetContract.userId)
        return updatedContract
    } catch (err) {
        const msg = `[activateNetworksFleet] Failed to create one or more tokens in networks ${networkNames} for contract ${String(fleetContract._id)} error or tokens ${err}`
        console.error(msg, err)
        throw new Error(msg)
    }
}

/**
 * Activates specific network for a fleet contract
 * Updates fleetContract in database
 * @returns {Promise<any>} updated contract
 */
export async function activateNetworkFleet({
  fleetContract, userContract, networkName, path
}: ActivateNetworkFleetParams): Promise<any> {
    try {
        const networkNames = getNetworkNames(networkName)
        return await activateNetworksFleet({
            fleetContract,
            userContract,
            networkNames,
            path
        })
    } catch (err) {
        const msg = `[activateNetworkFleet] Failed to create one or more tokens in network ${networkName} for contract ${String(fleetContract._id)} error or tokens ${err}`
        console.error(msg, err)
        throw new Error(msg)
    }
}

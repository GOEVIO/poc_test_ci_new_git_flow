import { describe, expect, it, jest } from '@jest/globals';
// Services
import switchboardsServices from '../../services/switchBoardsServices';
// Interfaces
import { ISwitchBoardsDocument } from '../../interfaces/switchBoardsInterfaces';
import { CHARGING_MODES, SHARING_MODES } from '../../utils/enums/switchboardsEnums';
// DB
import Switchboards from '../../models/switchBoards';

jest.mock('../../models/switchBoards');

describe('constructPatchObject', () => {
    it('should construct the patch object correctly', () => {
        const patchObject: Partial<ISwitchBoardsDocument> = {
            name: 'Test Switchboard',
            currentLimit: 20,
            chargingMode: CHARGING_MODES.Base_Mode,
            sharingMode: SHARING_MODES.FIFO,
            minSolarCurrent: 10,
        };

        const expectedPatchObject = {
            ...patchObject,
            setALimit: patchObject.currentLimit,
            setChargingMode: patchObject.chargingMode,
            setSharingMode: patchObject.sharingMode,
            setMinSolarCurrent: patchObject.minSolarCurrent,
        };

        const result = switchboardsServices.constructPatchObject(patchObject);

        expect(result).toEqual(expectedPatchObject);
    });
});

describe('validateSwitchboardUpdate', () => {
    const switchboard = {
        allowSharingModes: [SHARING_MODES.EVENLY_SPLIT, SHARING_MODES.FIFO],
        allowChargingModes: [CHARGING_MODES.Base_Mode, CHARGING_MODES.No_Mode],
    } as ISwitchBoardsDocument;

    it('should throw BadRequest error if switchboard is not found', async () => {
        const updateObject = {
            sharingMode: SHARING_MODES.NOT_APPLICABLE,
        };
        (Switchboards.findById as jest.Mock).mockReturnValueOnce(null);
        await expect(async () => {
            await switchboardsServices.validateSwitchboardUpdate('idTest', updateObject);
        }).rejects.toEqual({
            statusCode: 400,
            error: {
                status: false,
                code: 'switchboard_not_found',
                message: 'Switchboard not found',
            },
            context: '[ services switchBoards  validateSwitchboardUpdate ]',
        });
    })

    it('should throw BadRequest error if sharing mode is not allowed', async () => {
        const updateObject = {
            sharingMode: SHARING_MODES.NOT_APPLICABLE,
        };
        (Switchboards.findById as jest.Mock).mockReturnValueOnce(switchboard);
        await expect(async () => {
            await switchboardsServices.validateSwitchboardUpdate('idTest', updateObject);
        }).rejects.toEqual({
            statusCode: 400,
            error: {
                status: false,
                code: 'sharing_mode_not_allowed',
                message: 'Sharing mode not allowed for this switchboard',
            },
            context: '[ services switchBoards  validateSwitchboardUpdate ]',
        });
    });

    it('should throw BadRequest error if charging mode is not allowed', async () => {
        const updateObject = {
            chargingMode: CHARGING_MODES.Solar_Mode,
        };
        (Switchboards.findById as jest.Mock).mockReturnValueOnce(switchboard);
        await expect(async () => {
            await switchboardsServices.validateSwitchboardUpdate('idTest', updateObject);
        }).rejects.toEqual({
            statusCode: 400,
            error: {
                status: false,
                code: 'charging_mode_not_allowed',
                message: 'Charging mode not allowed for this switchboard',
            },
            context: '[ services switchBoards  validateSwitchboardUpdate ]',
        });
    });
    it('should not throw any error if sharing mode and charging mode are allowed', async () => {
        const updateObject = {
            sharingMode: SHARING_MODES.EVENLY_SPLIT,
            chargingMode: CHARGING_MODES.Base_Mode,
        };
        (Switchboards.findById as jest.Mock).mockReturnValueOnce(switchboard);
        const result = await switchboardsServices.validateSwitchboardUpdate('idTest', updateObject);
        expect(result).toEqual({
            allowChargingModes: ['Base Mode', 'No Mode'],
            allowSharingModes: ['Evenly Split', 'FIFO'],
        });
    });
});

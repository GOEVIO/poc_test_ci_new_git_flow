import { Request, Response, Send } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';

// Models
import switchboardModel from '../../models/switchBoards';
import controllersModel from '../../models/controllers';
// Controllers
import switchboardsController from '../../controllers/switchboardsController';

jest.mock('../../models/controllers', () => ({
    findById: jest.fn(),
}));
jest.mock('../../models/switchBoards', () => ({
    findById: jest.fn(),
}));

describe('getConfigs', () => {
    let req: Request;
    let res: Response;
    let switchboard;
    beforeEach(() => {
        req = {
            params: {
                id: '66600c5e36faec00139c10d5',
            },
        } as unknown as Request;

        res = {
            status: jest.fn(() => res),
            send: jest.fn() as Send,
        } as unknown as Response;
        jest.clearAllMocks();
        switchboard = {
            _id: '66600c5e36faec00139c10d5',
            arrayChargersId: [
                '6384c7ae457a35001396dd81',
                '6384d321457a35001398e3ef',
                '6384d6ef457a35001399887c',
                '6384d76e457a350013999b40',
                '6384da21457a3500139a1015',
                '6384dc92457a3500139a7bf0',
                '6384dd05457a3500139a89eb',
                '6384dd49457a3500139a9427',
                '6384f36cd4b6920013813cea',
                '6384f3e7d4b6920013814cea',
                '6384f40fd4b6920013815146',
                '6384f487d4b6920013815d7b',
                '6384f62ed4b692001381a53e',
                '6384f656d4b692001381a8e9',
                '6384f7d3d4b692001381e63d',
            ],
            allowChargingModes: ['Base Mode', 'Solar Mode', 'Schedule Mode', 'Unknown Mode'],
            name: 'SWB01',
            locationId: '66600c5c36faec00139c10c3',
            createUserId: '665dbadf0754bc0013b8f3a7',
            chargingMode: 'Base Mode',
            meterType: 'A8000',
            meterDescription: 'A8000',
            switchBoardGroupId: '1',
            deviceId: 'SWB01',
            activeSessions: 2,
            circuitBreaker: true,
            communicationFail: true,
            currentLimit: 15,
            i1: 1,
            i2: 1,
            i3: 1,
            importPower: 110000000,
            maxAllowedCurrent: 15,
            minSolarCurrent: 0,
            operationalMargin: 463.26,
            powerSetPointByEV: 8280000,
            sharingMode: 'FIFO',
            voltage: 1,
            allowSharingModes: ['FIFO', 'Evenly Split'],
            setALimit: 15,
            controllerId: '66600c5c36faec00139c10c4',
        };
    });

    it('should return the switchboard configuration if it exists', async () => {
        (switchboardModel.findById as jest.Mock).mockResolvedValueOnce(switchboard as never);
        switchboard.controllerId = '';
        await switchboardsController.getConfigs(req, res);
        expect(switchboardModel.findById).toHaveBeenCalledWith(switchboard._id);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.send).toHaveBeenCalledWith({
            id: switchboard._id,
            general_name: switchboard.name,
            general_cpe: '',
            chargingMode_energyManagement: switchboard.chargingMode,
            allowChargingModes: switchboard.allowChargingModes,
        });
    });

    it('should return the switchboard configuration if it exists', async () => {
        // with a8000 controller
        switchboard.controllerId = '66600c5c36faec00139c10c4', 
        (switchboardModel.findById as jest.Mock).mockReturnValueOnce(switchboard);
        (controllersModel.findById as jest.Mock).mockReturnValueOnce({
            _id: '66600c5c36faec00139c10c4',
            generalAlarm: false,
            communicationFaultAlarm: false,
            active: true,
            locationId: '66600c5c36faec00139c10c3',
            deviceId: 'AZ_DLMS',
            createUserId: '665dbadf0754bc0013b8f3a7',
            interface: 'MQTT',
            model: 'Siemens_A8000',
            name: 'Astrazenecea',
            updateInfo: {
                generalAlarm: false,
                commAlarm: false,
                _id: '6661c9dc6cc852001375c0e9',
                serial: 'A8000-RTU',
            },
        });
        await switchboardsController.getConfigs(req, res);
        expect(switchboardModel.findById).toHaveBeenCalledWith('66600c5e36faec00139c10d5');
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.send).toHaveBeenCalledWith({
            id: switchboard._id,
            general_name: switchboard.name,
            general_cpe: '',
            chargingMode_energyManagement: switchboard.chargingMode,
            allowChargingModes: switchboard.allowChargingModes,
            allowSharingModes: switchboard.allowSharingModes,
            currentLimit_energyManagement: switchboard.currentLimit,
            solarMinimum_energyManagement: switchboard.minSolarCurrent,
            sharingMode_energyManagement: switchboard.sharingMode,
        });
    });
    
    it('should return an error if the switchboard does not exist', async () => {
        (switchboardModel.findById as jest.Mock).mockReturnValueOnce(null as never);

        await switchboardsController.getConfigs(req, res);

        expect(switchboardModel.findById).toHaveBeenCalledWith('66600c5e36faec00139c10d5');
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_not_found',
            message: 'Switchboard not found',
        });
    });

    it('should handle errors and return an error response', async () => {
        const error = new Error('Internal Server Error');
        (switchboardModel.findById as jest.Mock).mockRejectedValue(error as never);

        await switchboardsController.getConfigs(req, res);

        expect(switchboardModel.findById).toHaveBeenCalledWith('66600c5e36faec00139c10d5');
        expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.send).toHaveBeenCalledWith('Internal Server Error');
    });
});

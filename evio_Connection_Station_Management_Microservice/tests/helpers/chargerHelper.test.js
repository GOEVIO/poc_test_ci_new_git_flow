const { determineTariffsToCalculate, generateTariffKey } = require('../../helpers/chargersHelper');

describe('determineTariffsToCalculate', () => {
    it('should return tariffId if isPublicNetwork is true', () => {
        const plug = { tariffId: 'tariff_test_1', tariff: [] };
        const result = determineTariffsToCalculate(plug, true, null);
        expect(result).toBe('tariff_test_1');
    });

    it('should return tariff for the fleet if isPublicNetwork is false and fleetId matches', () => {
        const plug = { 
            tariff: [{ fleetId: 'fleet_test', groupId: 'group_Id', groupName: 'Public' }]
        };
        const result = determineTariffsToCalculate(plug, false, '456');
        expect(result).toEqual([{ fleetId: 'fleet_test', groupId: 'group_Id', groupName: 'Public' }]);
    });

    it('should return tariff for the group if isPublicNetwork is false and userId matches', () => {
        const plug = { 
            tariff: [{ groupId: 'group_Id', groupName: 'Public' }]
        };
        const userGroupCSUsers = ['group_Id'];
        const result = determineTariffsToCalculate(plug, false, null, userGroupCSUsers);
        expect(result).toEqual([{ groupId: 'group_Id', groupName: 'Public' }]);
    });

    it('should return public tariff if isPublicNetwork is false and no match found', () => {
        const plug = { 
            tariff: [{ groupId: 'group_Id', groupName: 'Public' }]
        };
        const result = determineTariffsToCalculate(plug, false, null);
        expect(result).toEqual([{ groupId: 'group_Id', groupName: 'Public' }]);
    });
});



describe('generateTariffKey', () => {
    it('should generate a key based on tariffData and plug', () => {
        const tariffData = {
            tariff: { _id: 'tariff1' },
            elements: [{ _id: 'element1' }, { _id: 'element2' }],
            voltageLevel: 'level1'
        };
        const plug = {
            power: 'power1',
            voltage: 'voltage1'
        };

        const expectedKey = 'tariff1power1voltage1element1element2level1';
        const result = generateTariffKey(tariffData, plug);

        expect(result).toEqual(expectedKey);
    });

    it('should handle missing properties gracefully', () => {
        const tariffData = {};
        const plug = {};

        const expectedKey = '';
        const result = generateTariffKey(tariffData, plug);

        expect(result).toEqual(expectedKey);
    });
});
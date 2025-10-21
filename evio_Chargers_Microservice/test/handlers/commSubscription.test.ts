import { Request, Response, Send } from 'express';
import { StatusCodes } from 'http-status-codes';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const commsHandlers = require('../../handlers/commsSubscription');
let outputExample, inputExample, defaultExpected, inputDefault;

function defineOriginalValues(testingMethod) {
    if (testingMethod === 'createPlugBalancingMeasurements') {
        inputExample = [
            {
                name: 'CURRENT_LIMIT',
                unit: 'a',
                valueType: 'FLOAT',
                value: '16.333333333333332',
            },
            {
                name: 'ENERGY',
                unit: 'w/h',
                valueType: 'FLOAT',
                value: '11.22956753',
            },
            {
                name: 'TOTAL_CURRENT',
                unit: 'a',
                valueType: 'FLOAT',
                value: '48.16000366',
            },
            {
                name: 'NUMBER_OF_PHASES',
                unit: 'n/a',
                valueType: 'FLOAT',
                value: '3',
            },
            {
                name: 'STATE_NAME',
                unit: 'n/a',
                valueType: 'STRING',
                value: 'Charging',
            },
            {
                name: 'POWER_ACTIVE',
                unit: 'kw',
                valueType: 'FLOAT',
                value: '11187.2002',
            },
            { name: 'PRIORITY', unit: 'n/a', valueType: 'INTEGER', value: '0' },
            { name: 'VOLTAGE', unit: 'v', valueType: 'FLOAT', value: '0' },
        ];
    } else {
        inputDefault = {
            isOnline: true,
            lastMeasurement: '2024-10-22T14:43:20.453Z',
        };
    }
    defaultExpected = { lastMeasurement: '2024-10-22T14:43:20.453Z', isOnline: true };
    outputExample = {
        isOnline: true,
        lastMeasurement: '2024-10-22T08:46:55.328Z',
        currentLimit: '16.33',
        energy: '0.01',
        totalCurrent: '48.16',
        numberOfPhases: '3.00',
        operationalState: 'Charging',
        power: '11187.20',
        priority: '0.00',
        voltage: '232.29',
        current3: '16.05',
        current2: '16.05',
        current1: '16.05',
        currentPerPhase: '16.05',
        voltage3: '232.29',
        voltage2: '232.29',
        voltage1: '232.29',
    };
}

describe('Validate calculateMissingMeasurementsPlugs', () => {
    beforeEach(() => {
        defineOriginalValues('calculateMissingMeasurementsPlugs');
    });
     it('Success output of values', () => {
        const output = commsHandlers.calculateMissingMeasurementsPlugs(inputDefault);
        expect(output).toEqual(defaultExpected);
    });
    it('Test calculate numberOfPhases / totalCurrent / currentPerPhase', () => {
        let input1 = {
            ...inputDefault,
            current1: '16.05',
        };
        let expectedOutput1 = {
            ...defaultExpected,
            numberOfPhases: '1',
            current1: '16.05',
            totalCurrent: '16.05',
            currentPerPhase: '16.05',
        };
        const output1 = commsHandlers.calculateMissingMeasurementsPlugs(input1);
        expect(output1).toEqual(expectedOutput1);
        // add one more current
        let input2 = {
            ...inputDefault,
            current1: '16.05',
            current2: '16.05',
        };
        let expectedOutput2 = {
            ...expectedOutput1,
            current2: '16.05',
            numberOfPhases: '2',
            totalCurrent: '32.10',
        };
        const output2 = commsHandlers.calculateMissingMeasurementsPlugs(input2);
        expect(output2).toEqual(expectedOutput2);
        let input3 = {
            ...inputDefault,
            current1: '16.05',
            current2: '16.05',
            current3: '20.00',
        };
        let expectedOutput3 = {
            ...expectedOutput2,
            current3: '20.00',
            numberOfPhases: '3',
            totalCurrent: '52.10',
            currentPerPhase: '17.37',
        };
        const output3 = commsHandlers.calculateMissingMeasurementsPlugs(input3);
        expect(output3).toEqual(expectedOutput3);
    });
    it('Test calculate current1 / current2 / current3', () => {
        let input1 = {
            ...inputDefault,
            totalCurrent: '16.00',
            numberOfPhases: '1'
        };
        let expectedOutput1 = {
            ...defaultExpected,
            numberOfPhases: '1',
            totalCurrent: '16.00',
            currentPerPhase: '16.00'
        };
        const output1 = commsHandlers.calculateMissingMeasurementsPlugs(input1);
        expect(output1).toEqual(expectedOutput1);
        // add one more current
        let input2 = {
            ...inputDefault,
            totalCurrent: '16.00',
            numberOfPhases: '2'
        };
        let expectedOutput2 = {
            ...defaultExpected,
            numberOfPhases: '2',
            totalCurrent: '16.00',
            currentPerPhase: '8.00'
        };
        const output2 = commsHandlers.calculateMissingMeasurementsPlugs(input2);
        expect(output2).toEqual(expectedOutput2);
        let input3 = {
            ...inputDefault,
            totalCurrent: '16.00',
            numberOfPhases: '3',
        };
        let expectedOutput3 = {
            ...defaultExpected,
            current1: '5.33',
            current2: '5.33',
            current3: '5.33',
            numberOfPhases: '3',
            totalCurrent: '16.00',
            currentPerPhase: '5.33'
        };
        const output3 = commsHandlers.calculateMissingMeasurementsPlugs(input3);
        expect(output3).toEqual(expectedOutput3);
    });
    it('Test calculate voltage1 / voltage2 / voltage3', () => {
        let input1 = {
            ...inputDefault,
            voltage: '230.00',
        };
        let expectedOutput1 = {
            ...defaultExpected,
            voltage: '230.00',
        };
        const output1 = commsHandlers.calculateMissingMeasurementsPlugs(input1);
        expect(output1).toEqual(expectedOutput1);
        // add one more voltage
        let input2 = {
            ...inputDefault,
            voltage1: '230.00',
        };
        let expectedOutput2 = {
            ...defaultExpected,
            voltage1: '230.00',
            voltage: '230.00',
        };
        const output2 = commsHandlers.calculateMissingMeasurementsPlugs(input2);
        expect(output2).toEqual(expectedOutput2);
        let input3 = {
            ...inputDefault,
             voltage1: '230.00',
             voltage2: '230.00',
        };
        let expectedOutput3 = {
            ...defaultExpected,
            voltage1: '230.00',
            voltage2: '230.00',
            voltage: '230.00',
        };
        const output3 = commsHandlers.calculateMissingMeasurementsPlugs(input3);
        expect(output3).toEqual(expectedOutput3);
    });
    it('Test calculate Power with current and voltage', () => {
        let input1 = {
            ...inputDefault,
            voltage: '230.00',
            current3: '16.00'
        };
        let expectedOutput1 = {
            ...defaultExpected,
            current3: '16.00',
            totalCurrent: '16.00',
            voltage: '230.00',
            numberOfPhases: '1',
            currentPerPhase: '16.00',
            power:'3680.00'
        };
        const output1 = commsHandlers.calculateMissingMeasurementsPlugs(input1);
        expect(output1).toEqual(expectedOutput1);
        // add one more current
        let input2 = {
            ...inputDefault,
            voltage: '230.00',
            current3: '16.00',
            current2: '16.00'
        };
        let expectedOutput2 = {
            ...defaultExpected,
            current2: '16.00',
            current3: '16.00',
            totalCurrent: '32.00',
            voltage: '230.00',
            numberOfPhases: '2',
            currentPerPhase: '16.00',
            power:'7360.00'
        };
        const output2 = commsHandlers.calculateMissingMeasurementsPlugs(input2);
        expect(output2).toEqual(expectedOutput2);
        let input3 = {
            ...inputDefault,
            voltage: '230.00',
            current1: '16.00',
            current2: '16.00',
            current3: '16.00',
        };
        let expectedOutput3 = {
            ...defaultExpected,
            current1: '16.00',
            current2: '16.00',
            current3: '16.00',
            voltage1: '230.00',
            voltage2: '230.00',
            voltage3: '230.00',
            totalCurrent: '48.00',
            voltage: '230.00',
            numberOfPhases: '3',
            currentPerPhase: '16.00',
            power:'11040.00'
        };
        const output3 = commsHandlers.calculateMissingMeasurementsPlugs(input3);
        expect(output3).toEqual(expectedOutput3);
    });
});

describe('Validate createPlugBalancingMeasurements', () => {
    beforeEach(() => {
        defineOriginalValues('createPlugBalancingMeasurements');
    });

    it('Success output of values', () => {
        const output = commsHandlers.createPlugBalancingMeasurements(inputExample);
        outputExample.lastMeasurement = output.lastMeasurement; // just to not give error on date measurement
        expect(output).toEqual(outputExample);
    });

    it('Check if variable Error correct implemented', () => {
        let input = [
            {
                name: 'ERROR',
                unit: '',
                valueType: 'BOOLEAN',
                value: 'FALSE',
            },
        ];
        defaultExpected.isWithError = false;
        const output1 = commsHandlers.createPlugBalancingMeasurements(input);
        defaultExpected.lastMeasurement = output1.lastMeasurement;
        expect(output1).toEqual(defaultExpected);
        input[0].value = 'TRUE';
        defaultExpected.isWithError = true;
        const output2 = commsHandlers.createPlugBalancingMeasurements(input);
        defaultExpected.lastMeasurement = output2.lastMeasurement;
        expect(output2).toEqual(defaultExpected);
    });

    it('Check if variable Error correct implemented', () => {
        let input = [
            {
                name: 'ERROR_COMMUNICATION',
                unit: '',
                valueType: 'BOOLEAN',
                value: 'TRUE',
            },
        ];
        defaultExpected.isOnline = false;
        const output1 = commsHandlers.createPlugBalancingMeasurements(input);
        defaultExpected.lastMeasurement = output1.lastMeasurement;
        expect(output1).toEqual(defaultExpected);
        input[0].value = 'FALSE';
        defaultExpected.isOnline = true;
        const output2 = commsHandlers.createPlugBalancingMeasurements(input);
        defaultExpected.lastMeasurement = output2.lastMeasurement;
        expect(output2).toEqual(defaultExpected);
    });

    it('Check if variable CURRENT_L1 / CURRENT_L2 / CURRENT_L3 / CURRENT_LIMIT / TOTAL_CURRENT correct implemented', () => {
        let input = [
            {
                name: 'CURRENT_L1',
                unit: 'a',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'CURRENT_L2',
                unit: 'a',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'CURRENT_L3',
                unit: 'a',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'CURRENT_LIMIT',
                unit: 'a',
                valueType: 'FLOAT',
                value: 30.5858,
            },
            {
                name: 'TOTAL_CURRENT',
                unit: 'a',
                valueType: 'FLOAT',
                value: 48.99213,
            },
        ];
        let expected = {
            ...defaultExpected,
            current3: '16.33',
            current2: '16.33',
            current1: '16.33',
            currentPerPhase: '16.33',
            currentLimit: '30.59',
            totalCurrent: '48.99',
            numberOfPhases: '3',
        };
        const output1 = commsHandlers.createPlugBalancingMeasurements(input);
        expected.lastMeasurement = output1.lastMeasurement;
        expect(output1).toEqual(expected);
        // testing without TOTAL_CURRENT to check if calculates correctly
        input.pop();
        const output2 = commsHandlers.createPlugBalancingMeasurements(input);
        expected.lastMeasurement = output2.lastMeasurement;
        expect(output2).toEqual(expected);
    });

    it('Check if variable VOLTAGE_L1 / VOLTAGE_L2 / CURRENT_L3 / VOLTAGE_L3 / VOLTAGE correct implemented', () => {
        let input = [
            {
                name: 'VOLTAGE_L1',
                unit: 'v',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'VOLTAGE_L2',
                unit: 'v',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'VOLTAGE_L3',
                unit: 'v',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'VOLTAGE',
                unit: 'v',
                valueType: 'FLOAT',
                value: 30.5858,
            },
        ];
        let expected = {
            ...defaultExpected,
            voltage1: '16.33',
            voltage2: '16.33',
            voltage3: '16.33',
            voltage: '30.59',
        };
        const output = commsHandlers.createPlugBalancingMeasurements(input);
        expected.lastMeasurement = output.lastMeasurement;
        expect(output).toEqual(expected);
    });
    it('Check if variable POWER_ACTIVE / POWER_ACTIVE_MAX / POWER_ACTIVE_MIN  correct implemented', () => {
        let input = [
            {
                name: 'POWER_ACTIVE',
                unit: 'kw',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'POWER_ACTIVE_MAX',
                unit: 'kw',
                valueType: 'FLOAT',
                value: 16.333333333333332,
            },
            {
                name: 'POWER_ACTIVE_MIN',
                unit: 'w',
                valueType: 'FLOAT',
                value: 30.5858,
            },
        ];
        let expected = {
            ...defaultExpected,
            power: '16.33',
            powerMax: '16.33',
            minActivePower: '30.59',
        };
        const output = commsHandlers.createPlugBalancingMeasurements(input);
        expected.lastMeasurement = output.lastMeasurement;
        expect(output).toEqual(expected);
        input = [
            {
                name: 'POWER_ACTIVE',
                unit: 'w',
                valueType: 'FLOAT',
                value: 16333.333333333332,
            },
            {
                name: 'POWER_ACTIVE_MAX',
                unit: 'w',
                valueType: 'FLOAT',
                value: 16333.333333333332,
            },
            {
                name: 'POWER_ACTIVE_MIN',
                unit: 'kw',
                valueType: 'FLOAT',
                value: 0.0305858,
            },
        ];
        expected = {
            ...defaultExpected,
            power: '16.33',
            powerMax: '16.33',
            minActivePower: '30.59',
        };
        const output2 = commsHandlers.createPlugBalancingMeasurements(input);
        expected.lastMeasurement = output2.lastMeasurement;
        expect(output2).toEqual(expected);
    });
    it('Check if variable STATE_NAME / CONTROL_TYPE / PRIORITY / NUMBER_OF_PHASES  correct implemented', () => {
        let input = [
            {
                name: 'STATE_NAME',
                unit: 'n/a',
                valueType: 'STRING',
                value: 'Charging',
            },
            {
                name: 'CONTROL_TYPE',
                unit: 'n/a',
                valueType: 'STRING',
                value: 'MANUAL',
            },
            {
                name: 'PRIORITY',
                unit: 'n/a',
                valueType: 'FLOAT',
                value: 100,
            },
            {
                name: 'NUMBER_OF_PHASES',
                unit: 'n/a',
                valueType: 'FLOAT',
                value: 5,
            },
        ];
        let expected = {
            ...defaultExpected,
            numberOfPhases: '5.00',
            operationalState: 'Charging',
            priority: '100.00',
            controlType: 'MANUAL',
        };
        const output = commsHandlers.createPlugBalancingMeasurements(input);
        expected.lastMeasurement = output.lastMeasurement;
        expect(output).toEqual(expected);
    });
});
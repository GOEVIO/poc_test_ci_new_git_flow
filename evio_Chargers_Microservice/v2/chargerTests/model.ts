import { Schema, model } from 'mongoose';

export interface ITechnician {
    name: string;
}

export interface IModuleResult {
    name: string;
    result: string;
}

export interface IDetailedTest {
    module: string;
    testScenario: string;
    testDescription: string;
    ocppMandatory: boolean;
    testResult: string;
    testResultNotes: string;
}

export interface IChargerTest {
    brand: string;
    manufacturer: string;
    model: string;
    firmwareVersion: string;
    testingDate: string;
    techniciansName: ITechnician[];
    modulesResult: IModuleResult[];
    detailedTests: IDetailedTest[];
}

const ChargerTestSchema = new Schema<IChargerTest>(
    {
        brand: { type: String, required: true },
        manufacturer: { type: String, required: true },
        model: { type: String, required: true },
        firmwareVersion: { type: String, required: true },
        testingDate: { type: String, required: true },
        techniciansName: [
            {
                name: { type: String, required: true },
            },
        ],
        modulesResult: [
            {
                name: { type: String, required: true },
                result: { type: String, required: true },
            },
        ],
        detailedTests: [
            {
                module: { type: String, required: true },
                testScenario: { type: String, required: true },
                testDescription: { type: String, required: true },
                ocppMandatory: { type: Boolean, required: true },
                testResult: { type: String, required: true },
                testResultNotes: { type: String },
            },
        ],
    },
    {
        timestamps: true,
    }
);

const ChargerTest = model<IChargerTest>('ChargerTest', ChargerTestSchema);

export default ChargerTest;

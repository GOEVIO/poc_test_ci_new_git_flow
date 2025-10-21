import { TEST_STATUS } from './enums/chargerModelsEnums';

export function isTestStatusValid(value: string): boolean {
    return Object.values(TEST_STATUS).includes(value as TEST_STATUS);
}
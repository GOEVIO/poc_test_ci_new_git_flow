import path from 'path';
import Constants from '../utils/constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires,import/no-dynamic-require
const { name, version } = require(path.resolve('./package.json'));

export interface HealthCheckResponse {
    name: string;
    version: string;
    environment: string;
}

export default class HealthCheckController {
    // eslint-disable-next-line class-methods-use-this
    public async getData(): Promise<HealthCheckResponse> {
        return {
            name,
            version,
            environment: Constants.environment,
        };
    }
}

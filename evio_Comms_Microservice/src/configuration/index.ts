import MICROSERVICE from './microservice';
import DATABASE from './database';
import MQTT from './mqtt';
import ENDPOINTS from './externalEndpoints';
import CONTROLLER from './controller';
import SENTRY from './sentry';

import { IEnv } from '../interfaces/configurationsInterfaces';

const env: IEnv = {
    MICROSERVICE,
    DATABASE,
    MQTT,
    ENDPOINTS,
    CONTROLLER,
    SENTRY,
};

export default env;

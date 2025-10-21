import { IEnvToken } from '../interfaces/configurations.interface';

// Loading process.env as IEnvToken interface
const getConfig = (): IEnvToken => ({
    tokenSecret: String(process.env.TOKEN_SECRET),
    tokenLife: Number(process.env.TOKEN_LIFE),
    refreshTokenSecret: String(process.env.TOKEN_REFRESH_SECRET),
    refreshTokenLife: Number(process.env.TOKEN_REFRESH_LIFE),
    apiTokenLife: Number(process.env.EVIOAPI_TOKEN_LIFE),
    apiRefreshTokenLife: Number(process.env.EVIOAPI_REFRESH_LIFE),
});

export default getConfig();

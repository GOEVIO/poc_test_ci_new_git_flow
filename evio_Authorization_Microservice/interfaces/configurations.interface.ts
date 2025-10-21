export interface IEnvMicroservice {
    port: number,
    portDev: number,
    nodeEnv: string,
}

export interface IEnvDatabase {
    dbUri: string
}

export interface IEnvToken {
    tokenSecret: string,
    tokenLife: number,
    refreshTokenSecret: string,
    refreshTokenLife: number,
    apiTokenLife: number,
    apiRefreshTokenLife: number
}

export interface IEnv {
    microservice: IEnvMicroservice,
    database: IEnvDatabase,
    token: IEnvToken
}

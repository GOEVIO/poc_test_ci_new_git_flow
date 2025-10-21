import appData from '../../../package.json';

export enum LogLevel {
  info = 'info',
  error = 'error',
  warning = 'warning',
}

export type LogInfo = {
  time?: Date;
  serviceName?: string;
  type?: LogLevel;
  actionId: string;
  method?: string;
  url?: string;
  statusCode?: number;
  message?: any;
  context?: string;
  duration?: string;
  error?: any;
  errorStack?: any;
  responseBody?: any;
};

const stringifyIgnoreCircular = (obj) => {
  let cache = [];
  const str = JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        return;
      }
      cache.push(value);
    }
    return value;
  });
  cache = null;
  return str;
};

class LoggerService {
  private serviceName: string;

  constructor() {
    this.serviceName = appData.name;
  }

  private async log(logInfo: LogInfo) {
    console.log(
      JSON.stringify({
        ...logInfo,
        serviceName: this.serviceName,
        message: stringifyIgnoreCircular(logInfo.message),
        time: new Date(),
      })
    );
  }

  info(logInfo: LogInfo) {
    this.log({
      ...logInfo,
      type: LogLevel.info,
    });
  }

  warning(logInfo: LogInfo) {
    this.log({
      ...logInfo,
      type: LogLevel.info,
    });
  }

  error(logInfo: LogInfo) {
    this.log({
      ...logInfo,
      type: LogLevel.info,
    });
  }
}

export default LoggerService;
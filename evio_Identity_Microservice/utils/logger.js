const LogLevels = {
    info: 'Info',
    warning: 'Warning',
    error: 'Error',
};

const LogLevelsConsoleFn = {
    [LogLevels.info]: console.log,
    [LogLevels.warning]: console.warn,
    [LogLevels.error]: console.error,
};

const stringifyIgnoreCircular = (obj) => {
    let cache = [];
    const str = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Circular reference found, discard key
                return;
            }
            cache.push(value);
        }
        // eslint-disable-next-line consistent-return
        return value;
    });
    cache = null;
    return str;
};

class Logger {
    constructor(elasticSearchClient, microserviceName) {
        this.elasticSearchClient = elasticSearchClient;
        this.microserviceName = microserviceName;
    }

    async log(logLevel, context, message) {
        try {
            const body = {
                service: this.microserviceName,
                logLevel,
                context: String(context),
                message: stringifyIgnoreCircular(message),
                date: new Date()
            };

            LogLevelsConsoleFn[logLevel](context, message);

            this.elasticSearchClient?.index({
                index: 'evio-logs',
                body,
                type: 'application/json'
            });
        } catch (error) {
            LogLevelsConsoleFn[LogLevels.error]('[Logger][log] Error', error);
        }
    }

    info(context, message) {
        this.log(LogLevels.info, context, message);
    }

    warning(context, message) {
        this.log(LogLevels.warning, context, message);
    }

    error(context, message) {
        this.log(LogLevels.error, context, message);
    }
}

module.exports = { Logger, LogLevelsConsoleFn, LogLevels };

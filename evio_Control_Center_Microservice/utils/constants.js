require("dotenv-safe").load();

const env = {
    environment: process.env.NODE_ENV || "development",
    providers: {
        sentry:
        {
            traceSampleRate: Number(process.env.traceSampleRate || 0.1),
            profilesSampleRate: Number(process.env.profilesSampleRate || 0.1),
            dsn: process.env.dsn || 'https://49775ddcbaa94bf20145d6b370d7fcfa@o4505861147131904.ingest.us.sentry.io/4507192267636736'
        }
    },
    identity: {
        host: process.env.HostUser || 'http://identity:3003',
        pathPatchCemeTarrifUser: '/api/private/cemeTariff/allContracts'
    },
}
module.exports = {
    env
}

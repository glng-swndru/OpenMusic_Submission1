// eslint-disable-next-line import/no-extraneous-dependencies
const redis = require('redis');

class CacheService {
    constructor() {
        this._client = redis.createClient({
            socket: {
                host: '127.0.0.1',
            },
        });

        this._client.on('error', (error) => {
            console.log(error);
        });

        this._client.connect();
    }

    async set(key, value, expirationInSecond = 1800) {
        await this._client.set(key, value, {
            EX: expirationInSecond,
        });
    }

    async get(key) {
        const result = await this._client.get(key);

        if (result === null) throw new Error('Cache tidak ditemukan');

        return result;
    }

    delete(key) {
        return this._client.del(key);
    }
}

module.exports = CacheService;

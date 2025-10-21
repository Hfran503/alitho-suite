"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.getDatabaseUrl = getDatabaseUrl;
exports.getNextAuthSecret = getNextAuthSecret;
exports.getRedisUrl = getRedisUrl;
exports.getPaceApiCredentials = getPaceApiCredentials;
exports.getAllSecrets = getAllSecrets;
exports.clearSecretsCache = clearSecretsCache;
exports.getEasyPostApiKey = getEasyPostApiKey;
exports.saveEasyPostApiKey = saveEasyPostApiKey;
exports.deleteEasyPostApiKey = deleteEasyPostApiKey;
exports.getShipStationApiKey = getShipStationApiKey;
exports.saveShipStationApiKey = saveShipStationApiKey;
exports.deleteShipStationApiKey = deleteShipStationApiKey;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client = new client_secrets_manager_1.SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.S3_REGION || 'us-west-1',
});
const secretsCache = new Map();
async function getSecret(secretName, parseJson = true) {
    if (secretsCache.has(secretName)) {
        return secretsCache.get(secretName);
    }
    try {
        const command = new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: secretName,
        });
        const response = await client.send(command);
        let secret;
        if (response.SecretString) {
            secret = parseJson ? JSON.parse(response.SecretString) : response.SecretString;
        }
        else if (response.SecretBinary) {
            const buff = Buffer.from(response.SecretBinary);
            secret = buff.toString('ascii');
        }
        else {
            throw new Error('Secret has no value');
        }
        secretsCache.set(secretName, secret);
        return secret;
    }
    catch (error) {
        console.error(`Error fetching secret ${secretName}:`, error);
        throw error;
    }
}
async function getDatabaseUrl() {
    if (process.env.NODE_ENV === 'development' && process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }
    try {
        const secretName = process.env.AWS_SECRET_DATABASE || 'calitho-suite/database';
        const secret = await getSecret(secretName);
        return secret.DATABASE_URL || secret.url || secret.connectionString;
    }
    catch (error) {
        if (process.env.DATABASE_URL) {
            console.warn('Failed to fetch database secret, using env var');
            return process.env.DATABASE_URL;
        }
        throw new Error('DATABASE_URL not found in Secrets Manager or environment');
    }
}
async function getNextAuthSecret() {
    try {
        const secretName = process.env.AWS_SECRET_NEXTAUTH || 'calitho-suite/nextauth';
        const secret = await getSecret(secretName);
        return secret.NEXTAUTH_SECRET || secret.secret;
    }
    catch (error) {
        if (process.env.NEXTAUTH_SECRET) {
            console.warn('Failed to fetch NextAuth secret from AWS, using env var');
            return process.env.NEXTAUTH_SECRET;
        }
        throw new Error('NEXTAUTH_SECRET not found in Secrets Manager or environment');
    }
}
async function getRedisUrl() {
    if (process.env.NODE_ENV === 'development' && process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }
    try {
        const secretName = process.env.AWS_SECRET_REDIS || 'calitho-suite/redis';
        const secret = await getSecret(secretName);
        return secret.REDIS_URL || secret.url;
    }
    catch (error) {
        if (process.env.REDIS_URL) {
            console.warn('Failed to fetch Redis secret, using env var');
            return process.env.REDIS_URL;
        }
        throw new Error('REDIS_URL not found in Secrets Manager or environment');
    }
}
async function getPaceApiCredentials() {
    if (process.env.NODE_ENV === 'development' &&
        process.env.PACE_API_URL &&
        process.env.PACE_USERNAME &&
        process.env.PACE_PASSWORD) {
        return {
            url: process.env.PACE_API_URL,
            username: process.env.PACE_USERNAME,
            password: process.env.PACE_PASSWORD,
        };
    }
    try {
        const secretName = process.env.AWS_SECRET_PACE || 'calitho-suite/pace';
        const secret = await getSecret(secretName);
        const url = secret.PACE_API_URL || secret.url || secret.apiUrl;
        const username = secret.PACE_USERNAME || secret.username;
        const password = secret.PACE_PASSWORD || secret.password;
        if (!url || !username || !password) {
            throw new Error('PACE API credentials incomplete in Secrets Manager');
        }
        return { url, username, password };
    }
    catch (error) {
        if (process.env.PACE_API_URL && process.env.PACE_USERNAME && process.env.PACE_PASSWORD) {
            console.warn('Failed to fetch PACE API secret, using env vars');
            return {
                url: process.env.PACE_API_URL,
                username: process.env.PACE_USERNAME,
                password: process.env.PACE_PASSWORD,
            };
        }
        throw new Error('PACE API credentials not found in Secrets Manager or environment');
    }
}
async function getAllSecrets() {
    const [databaseUrl, nextAuthSecret, redisUrl, paceApi] = await Promise.allSettled([
        getDatabaseUrl(),
        getNextAuthSecret(),
        getRedisUrl(),
        getPaceApiCredentials(),
    ]);
    return {
        databaseUrl: databaseUrl.status === 'fulfilled' ? databaseUrl.value : process.env.DATABASE_URL,
        nextAuthSecret: nextAuthSecret.status === 'fulfilled'
            ? nextAuthSecret.value
            : process.env.NEXTAUTH_SECRET,
        redisUrl: redisUrl.status === 'fulfilled' ? redisUrl.value : process.env.REDIS_URL,
        paceApi: paceApi.status === 'fulfilled'
            ? paceApi.value
            : {
                url: process.env.PACE_API_URL,
                username: process.env.PACE_USERNAME,
                password: process.env.PACE_PASSWORD,
            },
    };
}
function clearSecretsCache() {
    secretsCache.clear();
}
async function getEasyPostApiKey(tenantId, mode = 'test') {
    const secretName = `calitho-suite/integrations/easypost/${tenantId}`;
    try {
        const secret = await getSecret(secretName, true);
        const apiKey = mode === 'test' ? secret.testApiKey : secret.productionApiKey;
        if (!apiKey) {
            throw new Error(`EasyPost ${mode} API key not found for tenant ${tenantId}`);
        }
        return apiKey;
    }
    catch (error) {
        throw new Error(`EasyPost API keys not found for tenant ${tenantId}`);
    }
}
async function saveEasyPostApiKey(tenantId, testApiKey, productionApiKey) {
    const secretName = `calitho-suite/integrations/easypost/${tenantId}`;
    let existingSecret = {};
    try {
        existingSecret = await getSecret(secretName, true);
    }
    catch (error) {
    }
    const secretValue = {
        testApiKey: testApiKey || existingSecret.testApiKey,
        productionApiKey: productionApiKey || existingSecret.productionApiKey,
    };
    const secretString = JSON.stringify(secretValue);
    try {
        const updateCommand = new client_secrets_manager_1.UpdateSecretCommand({
            SecretId: secretName,
            SecretString: secretString,
        });
        await client.send(updateCommand);
        secretsCache.set(secretName, secretValue);
    }
    catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            const createCommand = new client_secrets_manager_1.CreateSecretCommand({
                Name: secretName,
                SecretString: secretString,
                Description: `EasyPost API keys for tenant ${tenantId}`,
                Tags: [
                    { Key: 'Application', Value: 'calitho-suite' },
                    { Key: 'Integration', Value: 'easypost' },
                    { Key: 'TenantId', Value: tenantId },
                ],
            });
            await client.send(createCommand);
            secretsCache.set(secretName, secretValue);
        }
        else {
            throw error;
        }
    }
}
async function deleteEasyPostApiKey(tenantId) {
    const secretName = `calitho-suite/integrations/easypost/${tenantId}`;
    try {
        const deleteCommand = new client_secrets_manager_1.DeleteSecretCommand({
            SecretId: secretName,
            ForceDeleteWithoutRecovery: false,
        });
        await client.send(deleteCommand);
        secretsCache.delete(secretName);
    }
    catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }
}
async function getShipStationApiKey(tenantId, mode = 'test') {
    const secretName = `calitho-suite/integrations/shipstation/${tenantId}`;
    try {
        const secret = await getSecret(secretName, true);
        const apiKey = mode === 'test' ? secret.testApiKey : secret.productionApiKey;
        if (!apiKey) {
            throw new Error(`ShipStation ${mode} API key not found for tenant ${tenantId}`);
        }
        return apiKey;
    }
    catch (error) {
        throw new Error(`ShipStation API keys not found for tenant ${tenantId}`);
    }
}
async function saveShipStationApiKey(tenantId, testApiKey, productionApiKey) {
    const secretName = `calitho-suite/integrations/shipstation/${tenantId}`;
    let existingSecret = {};
    try {
        existingSecret = await getSecret(secretName, true);
    }
    catch (error) {
    }
    const secretValue = {
        testApiKey: testApiKey || existingSecret.testApiKey,
        productionApiKey: productionApiKey || existingSecret.productionApiKey,
    };
    const secretString = JSON.stringify(secretValue);
    try {
        const updateCommand = new client_secrets_manager_1.UpdateSecretCommand({
            SecretId: secretName,
            SecretString: secretString,
        });
        await client.send(updateCommand);
        secretsCache.set(secretName, secretValue);
    }
    catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            const createCommand = new client_secrets_manager_1.CreateSecretCommand({
                Name: secretName,
                SecretString: secretString,
                Description: `ShipStation API keys for tenant ${tenantId}`,
                Tags: [
                    { Key: 'Application', Value: 'calitho-suite' },
                    { Key: 'Integration', Value: 'shipstation' },
                    { Key: 'TenantId', Value: tenantId },
                ],
            });
            await client.send(createCommand);
            secretsCache.set(secretName, secretValue);
        }
        else {
            throw error;
        }
    }
}
async function deleteShipStationApiKey(tenantId) {
    const secretName = `calitho-suite/integrations/shipstation/${tenantId}`;
    try {
        const deleteCommand = new client_secrets_manager_1.DeleteSecretCommand({
            SecretId: secretName,
            ForceDeleteWithoutRecovery: false,
        });
        await client.send(deleteCommand);
        secretsCache.delete(secretName);
    }
    catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }
}
//# sourceMappingURL=secrets.js.map
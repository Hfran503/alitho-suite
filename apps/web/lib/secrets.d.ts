export declare function getSecret(secretName: string, parseJson?: boolean): Promise<any>;
export declare function getDatabaseUrl(): Promise<string>;
export declare function getNextAuthSecret(): Promise<string>;
export declare function getRedisUrl(): Promise<string>;
export declare function getPaceApiCredentials(): Promise<{
    url: string;
    username: string;
    password: string;
}>;
export declare function getAllSecrets(): Promise<{
    databaseUrl: string | undefined;
    nextAuthSecret: string | undefined;
    redisUrl: string | undefined;
    paceApi: {
        url: string | undefined;
        username: string | undefined;
        password: string | undefined;
    };
}>;
export declare function clearSecretsCache(): void;
export declare function getEasyPostApiKey(tenantId: string, mode?: 'test' | 'production'): Promise<string>;
export declare function saveEasyPostApiKey(tenantId: string, testApiKey?: string, productionApiKey?: string): Promise<void>;
export declare function deleteEasyPostApiKey(tenantId: string): Promise<void>;
export declare function getShipStationApiKey(tenantId: string, mode?: 'test' | 'production'): Promise<string>;
export declare function saveShipStationApiKey(tenantId: string, testApiKey?: string, productionApiKey?: string): Promise<void>;
export declare function deleteShipStationApiKey(tenantId: string): Promise<void>;
//# sourceMappingURL=secrets.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipStationClient = void 0;
exports.getShipStationClient = getShipStationClient;
exports.isShipStationConfigured = isShipStationConfigured;
const secrets_1 = require("./secrets");
const database_1 = require("@repo/database");
const SHIPSTATION_BASE_URL = 'https://api.shipengine.com/v1';
class ShipStationClient {
    apiKey;
    baseUrl;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || SHIPSTATION_BASE_URL;
    }
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'API-Key': this.apiKey,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('ShipStation API Error Details:', {
                status: response.status,
                statusText: response.statusText,
                error: error,
                endpoint: endpoint,
            });
            throw new Error(`ShipStation API error: ${response.status} - ${error.message || JSON.stringify(error) || response.statusText}`);
        }
        return response.json();
    }
    async testConnection() {
        try {
            await this.request('/account/settings', {
                method: 'GET',
            });
            return true;
        }
        catch (error) {
            console.error('ShipStation connection test failed:', error);
            return false;
        }
    }
    async getRates(params) {
        return this.request('/rates', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    async createLabels(params) {
        return this.request('/labels', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    async voidLabel(labelId) {
        return this.request(`/labels/${labelId}/void`, {
            method: 'PUT',
        });
    }
    async getLabel(labelId) {
        return this.request(`/labels/${labelId}`, {
            method: 'GET',
        });
    }
    async listCarriers() {
        return this.request('/carriers', {
            method: 'GET',
        });
    }
}
exports.ShipStationClient = ShipStationClient;
async function getShipStationClient(tenantId) {
    const integration = await database_1.db.integration.findUnique({
        where: {
            tenantId_provider: {
                tenantId,
                provider: 'shipstation',
            },
        },
        select: {
            config: true,
        },
    });
    const mode = integration?.config?.mode || 'test';
    const apiKey = await (0, secrets_1.getShipStationApiKey)(tenantId, mode);
    return new ShipStationClient({ apiKey });
}
async function isShipStationConfigured(tenantId, mode = 'test') {
    try {
        await (0, secrets_1.getShipStationApiKey)(tenantId, mode);
        return true;
    }
    catch (error) {
        return false;
    }
}
//# sourceMappingURL=shipstation.js.map
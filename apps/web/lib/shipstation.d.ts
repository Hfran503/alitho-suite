interface ShipStationConfig {
    apiKey: string;
    baseUrl?: string;
}
export declare class ShipStationClient {
    private apiKey;
    private baseUrl;
    constructor(config: ShipStationConfig);
    private request;
    testConnection(): Promise<boolean>;
    getRates(params: {
        shipment: {
            ship_to: {
                name?: string;
                phone?: string;
                company_name?: string;
                address_line1: string;
                address_line2?: string;
                city_locality: string;
                state_province: string;
                postal_code: string;
                country_code: string;
            };
            ship_from: {
                name?: string;
                phone?: string;
                company_name?: string;
                address_line1: string;
                address_line2?: string;
                city_locality: string;
                state_province: string;
                postal_code: string;
                country_code: string;
            };
            packages: Array<{
                weight: {
                    value: number;
                    unit: 'pound' | 'ounce' | 'gram' | 'kilogram';
                };
                dimensions?: {
                    length: number;
                    width: number;
                    height: number;
                    unit: 'inch' | 'centimeter';
                };
            }>;
        };
        rate_options?: {
            carrier_ids?: string[];
            service_codes?: string[];
        };
    }): Promise<any>;
    createLabels(params: {
        shipment: {
            carrier_id: string;
            service_code: string;
            ship_to: {
                name: string;
                phone?: string;
                company_name?: string;
                address_line1: string;
                address_line2?: string;
                city_locality: string;
                state_province: string;
                postal_code: string;
                country_code: string;
            };
            ship_from: {
                name: string;
                phone?: string;
                company_name?: string;
                address_line1: string;
                address_line2?: string;
                city_locality: string;
                state_province: string;
                postal_code: string;
                country_code: string;
            };
            packages: Array<{
                weight: {
                    value: number;
                    unit: 'pound' | 'ounce' | 'gram' | 'kilogram';
                };
                dimensions?: {
                    length: number;
                    width: number;
                    height: number;
                    unit: 'inch' | 'centimeter';
                };
                label_messages?: {
                    reference1?: string;
                    reference2?: string;
                    reference3?: string;
                };
            }>;
        };
        label_format?: 'pdf' | 'zpl' | 'png';
        label_layout?: '4x6' | 'letter';
    }): Promise<any>;
    voidLabel(labelId: string): Promise<any>;
    getLabel(labelId: string): Promise<any>;
    listCarriers(): Promise<any>;
}
export declare function getShipStationClient(tenantId: string): Promise<ShipStationClient>;
export declare function isShipStationConfigured(tenantId: string, mode?: 'test' | 'production'): Promise<boolean>;
export {};
//# sourceMappingURL=shipstation.d.ts.map
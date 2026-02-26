export interface Proxy {
    id: string;
    protocol: string;
    host: string;
    port: number;
    user?: string;
    pass?: string;
    latency_ms?: number;
    is_alive: boolean;
}

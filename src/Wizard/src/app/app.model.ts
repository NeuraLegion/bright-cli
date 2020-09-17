export interface ItemStatus {
    ok: boolean;
    msg?: string;
}

export interface ConnectivityStatus {
    tcp: ItemStatus;
    https: ItemStatus;
    auth: ItemStatus;
}

export interface Tokens {
    authToken: string;
    repeaterId: string;
}
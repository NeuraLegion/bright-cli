import { Protocol } from '../RequestExecutor';

export interface RepeaterServerDeployedEvent {
  repeaterId: string;
}

export interface RepeaterServerRequestEvent {
  protocol: Protocol;
  url: string;
  method?: string;
  headers?: Record<string, string | string[]>;
  correlationIdRegex?: string;
  body?: string;
}

export interface RepeaterServerRequestResponse {
  protocol: Protocol;
  statusCode?: number;
  message?: string;
  errorCode?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
}

export interface RepeaterServerReconnectionFailedEvent {
  error: Error;
}

export type RepeaterServerEvents =
  | 'deployed'
  | 'request'
  | 'reconnection_failed';
export type RepeaterServerEventHandlers =
  | RepeaterServerEventHandler<RepeaterServerDeployedEvent>
  | RepeaterServerEventHandler<
      RepeaterServerRequestEvent,
      RepeaterServerRequestResponse
    >
  | RepeaterServerEventHandler<RepeaterServerReconnectionFailedEvent>;

export type RepeaterServerEventHandler<P, R = void> = (
  payload: P
) => R | Promise<R>;

export interface RepeaterServer {
  disconnect(): void;

  connect(): void;

  deploy(repeaterId?: string): Promise<RepeaterServerDeployedEvent>;

  on(
    event: 'request',
    handler: RepeaterServerEventHandler<
      RepeaterServerRequestEvent,
      RepeaterServerRequestResponse
    >
  ): void;
  on(
    event: 'reconnection_failed',
    handler: RepeaterServerEventHandler<RepeaterServerReconnectionFailedEvent>
  ): void;
  on(event: RepeaterServerEvents, handler: RepeaterServerEventHandlers): void;

  ping(): void;
}

export const RepeaterServer: unique symbol = Symbol('RepeaterServer');

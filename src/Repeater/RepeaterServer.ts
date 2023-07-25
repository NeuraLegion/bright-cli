import { Protocol } from '../RequestExecutor';

export interface RepeaterServerEvent<I, O = void> {
  request: I;
  response: O;
}

export type RepeaterServerRequestEvent = RepeaterServerEvent<
  {
    protocol: Protocol;
    url: string;
    method?: string;
    headers?: Record<string, string | string[]>;
    correlationIdRegex?: string;
    body?: string;
  },
  {
    protocol: Protocol;
    statusCode?: number;
    message?: string;
    errorCode?: string;
    headers?: Record<string, string | string[] | undefined>;
    body?: string;
  }
>;

export type RepeaterServerDeployedEvent = RepeaterServerEvent<
  undefined,
  {
    repeaterId: string;
  }
>;

export type RepeaterServerReconnectionFailedEvent = RepeaterServerEvent<{
  error: Error;
}>;

export interface RepeaterServerEvents {
  deployed: RepeaterServerDeployedEvent;
  request: RepeaterServerRequestEvent;
  reconnection_failed: RepeaterServerReconnectionFailedEvent;
}

export type RepeaterServerEventHandler<E extends keyof RepeaterServerEvents> = (
  payload: RepeaterServerEvents[E]['request']
) =>
  | RepeaterServerEvents[E]['response']
  | Promise<RepeaterServerEvents[E]['response']>;

export interface RepeaterServer {
  disconnect(): void;

  connect(): void;

  deploy(repeaterId?: string): Promise<RepeaterServerDeployedEvent['response']>;

  on<
    E extends keyof RepeaterServerEvents,
    H extends RepeaterServerEventHandler<E>
  >(
    event: E,
    handler: H
  ): void;

  ping(): void;
}

export const RepeaterServer: unique symbol = Symbol('RepeaterServer');

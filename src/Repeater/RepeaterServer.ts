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

export type RepeaterServerRequestResponse =
  | {
      protocol: Protocol;
      statusCode?: number;
      message?: string;
      errorCode?: string;
      headers?: Record<string, string | string[] | undefined>;
      body?: string;
    }
  | {
      protocol: Protocol;
      message?: string;
      errorCode?: string;
    };

export interface RepeaterServerReconnectionFailedEvent {
  error: Error;
}

export interface RepeaterServerReconnectionAttemptedEvent {
  attempt: number;
  maxAttempts: number;
}

export interface RepeaterServerErrorEvent {
  message: string;
}

export type RepeaterServerEvents = 'request' | 'reconnection_failed' | 'error';
export type RepeaterServerEventHandlers =
  | RepeaterServerEventHandler<RepeaterServerDeployedEvent>
  | RepeaterServerEventHandler<
      RepeaterServerRequestEvent,
      RepeaterServerRequestResponse
    >
  | RepeaterServerEventHandler<RepeaterServerReconnectionFailedEvent>
  | RepeaterServerEventHandler<RepeaterServerErrorEvent>;

export type RepeaterServerEventHandler<P, R = void> = P extends undefined
  ? () => R | Promise<R>
  : (payload: P) => R | Promise<R>;

export interface RepeaterServer {
  disconnect(): void;

  connect(hostname: string): void;

  deploy(repeaterId?: string): Promise<RepeaterServerDeployedEvent>;

  requestReceived(
    handler: RepeaterServerEventHandler<
      RepeaterServerRequestEvent,
      RepeaterServerRequestResponse
    >
  ): void;

  reconnectionFailed(
    handler: RepeaterServerEventHandler<RepeaterServerReconnectionFailedEvent>
  ): void;

  reconnectionAttempted(
    handler: RepeaterServerEventHandler<RepeaterServerReconnectionAttemptedEvent>
  ): void;

  reconnectionSucceeded(handler: RepeaterServerEventHandler<undefined>): void;

  errorOccurred(
    handler: RepeaterServerEventHandler<RepeaterServerErrorEvent>
  ): void;
}

export const RepeaterServer: unique symbol = Symbol('RepeaterServer');

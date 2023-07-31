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

export interface RepeaterServer {
  disconnect(): void;

  connect(hostname: string): void;

  deploy(repeaterId?: string): Promise<RepeaterServerDeployedEvent>;

  requestReceived(
    handler: (
      event: RepeaterServerRequestEvent
    ) => RepeaterServerRequestResponse | Promise<RepeaterServerRequestResponse>
  ): void;

  reconnectionFailed(
    handler: (
      event: RepeaterServerReconnectionFailedEvent
    ) => void | Promise<void>
  ): void;

  reconnectionAttempted(
    handler: (
      event: RepeaterServerReconnectionAttemptedEvent
    ) => void | Promise<void>
  ): void;

  reconnectionSucceeded(handler: () => void | Promise<void>): void;

  errorOccurred(
    handler: (event: RepeaterServerErrorEvent) => void | Promise<void>
  ): void;
}

export const RepeaterServer: unique symbol = Symbol('RepeaterServer');

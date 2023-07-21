import { Protocol } from '../RequestExecutor';

export interface RepeaterEvent<I, O = void> {
  request: I;
  response: O;
}

export type RepeaterRequestEvent = RepeaterEvent<
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

export type RepeaterDeployedEvent = RepeaterEvent<
  undefined,
  {
    repeaterId: string;
  }
>;

export type RepeaterReconnectionFailedEvent = RepeaterEvent<{
  error: Error;
}>;

export interface RepeaterEvents {
  deployed: RepeaterDeployedEvent;
  request: RepeaterRequestEvent;
  reconnection_failed: RepeaterReconnectionFailedEvent;
}

export type RepeaterEventHandler<E extends keyof RepeaterEvents> = (
  payload: RepeaterEvents[E]['request']
) => RepeaterEvents[E]['response'] | Promise<RepeaterEvents[E]['response']>;

export interface Repeater {
  disconnect(): void;

  connect(): void;

  deploy(repeaterId?: string): Promise<RepeaterDeployedEvent['response']>;

  on<E extends keyof RepeaterEvents, H extends RepeaterEventHandler<E>>(
    event: E,
    handler: H
  ): void;
}

export const Repeater: unique symbol = Symbol('Repeater');

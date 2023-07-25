import { logger } from '../Utils';
import {
  RepeaterServer,
  RepeaterServerEventHandler,
  RepeaterServerDeployedEvent,
  RepeaterServerEvents
} from './RepeaterServer';
import { inject, injectable } from 'tsyringe';
import io, { Socket } from 'socket.io-client';
import parser from 'socket.io-msgpack-parser';
import { hostname } from 'os';
import { once } from 'events';

export interface DefaultRepeaterServerOptions {
  readonly uri: string;
  readonly token: string;
}

export const DefaultRepeaterServerOptions: unique symbol = Symbol(
  'DefaultRepeaterServerOptions'
);

@injectable()
export class DefaultRepeaterServer implements RepeaterServer {
  private latestReconnectionError?: Error;
  private readonly DEFAULT_RECONNECT_TIMES = 3;
  private socket?: Socket;

  constructor(
    @inject(DefaultRepeaterServerOptions)
    private readonly options: DefaultRepeaterServerOptions
  ) {}

  public disconnect() {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    this.socket.disconnect();
    this.socket.removeAllListeners();
    this.socket = undefined;
  }

  public async deploy(
    repeaterId?: string
  ): Promise<RepeaterServerDeployedEvent['response']> {
    if (!this.socket) {
      throw new Error('Repeater is not connected yet');
    }

    this.socket.emit('deploy', {
      repeaterId
    });

    const [result]: RepeaterServerDeployedEvent['response'][] = await once(
      this.socket,
      'deployed'
    );

    return result;
  }

  public connect() {
    this.socket = io(this.options.uri, {
      parser,
      path: '/api/ws/v1',
      transports: ['websocket'],
      reconnectionAttempts: this.DEFAULT_RECONNECT_TIMES,
      auth: {
        token: this.options.token,
        domain: hostname()
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      logger.debug(`Unexpected error: %s`, error);
    });

    logger.debug('Event bus connected to %s', this.options.uri);
  }

  public on<
    E extends keyof RepeaterServerEvents,
    H extends RepeaterServerEventHandler<E>
  >(event: E, handler: H): void {
    const eventName: string = event;

    if (event === 'reconnection_failed') {
      // TODO: Figure out why type is not narrowing
      this.onReconnectionFailure(handler as any);
    } else {
      this.socket.on(eventName, (payload, callback) => {
        this.processEventHandler(event, payload, handler, callback);
      });
    }
  }

  private onReconnectionFailure<
    H extends RepeaterServerEventHandler<'reconnection_failed'>
  >(handler: H) {
    this.socket.io.on('reconnect', () => {
      this.latestReconnectionError = undefined;
    });

    this.socket.io.on('reconnect_error', (error) => {
      this.latestReconnectionError = error;
    });

    this.socket.io.on('reconnect_failed', () => {
      this.processEventHandler(
        'reconnection_failed',
        {
          error: this.latestReconnectionError
        },
        handler
      );
    });
  }

  private processEventHandler<
    E extends keyof RepeaterServerEvents,
    H extends RepeaterServerEventHandler<E>
  >(
    event: E,
    payload: RepeaterServerEvents[E]['request'],
    handler: H,
    callback?: unknown
  ) {
    Promise.resolve(handler(payload))
      .then((response) => {
        if (typeof callback !== 'function' || typeof response === 'undefined') {
          return;
        }

        callback(response);
      })
      .catch((error) => {
        logger.debug(
          'Error processing event "%s" with the following payload: %s. Details: %s',
          event,
          payload,
          error
        );
        logger.error('Error: %s', error.message);
      });
  }
}

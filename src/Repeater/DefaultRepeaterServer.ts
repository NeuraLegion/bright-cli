import { logger } from '../Utils';
import {
  RepeaterServer,
  RepeaterServerEventHandler,
  RepeaterServerDeployedEvent,
  RepeaterServerReconnectionFailedEvent,
  RepeaterServerRequestEvent,
  RepeaterServerRequestResponse,
  RepeaterServerErrorEvent,
  RepeaterServerReconnectionAttemptedEvent
} from './RepeaterServer';
import { inject, injectable } from 'tsyringe';
import io, { Socket } from 'socket.io-client';
import parser from 'socket.io-msgpack-parser';
import { once } from 'events';
import Timer = NodeJS.Timer;

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
  private readonly MAX_RECONNECTION_ATTEMPTS = 20;
  private _socket?: Socket;
  private timer?: Timer;

  constructor(
    @inject(DefaultRepeaterServerOptions)
    private readonly options: DefaultRepeaterServerOptions
  ) {}

  public disconnect() {
    this.clearPingTimer();

    this._socket?.disconnect();
    this._socket?.removeAllListeners();
    this._socket = undefined;
  }

  public async deploy(
    repeaterId?: string
  ): Promise<RepeaterServerDeployedEvent> {
    this.socket.emit('deploy', {
      repeaterId
    });

    const [result]: RepeaterServerDeployedEvent[] = await once(
      this.socket,
      'deployed'
    );

    return result;
  }

  public connect(hostname: string) {
    this._socket = io(this.options.uri, {
      parser,
      path: '/api/ws/v1',
      transports: ['websocket'],
      reconnectionAttempts: this.MAX_RECONNECTION_ATTEMPTS,
      auth: {
        token: this.options.token,
        domain: hostname
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      logger.debug(`Unable to connect to the %s host`, this.options.uri, error);
    });

    this.createPingTimer();

    logger.debug('Event bus connected to %s', this.options.uri);
  }

  public requestReceived(
    handler: RepeaterServerEventHandler<
      RepeaterServerRequestEvent,
      RepeaterServerRequestResponse
    >
  ): void {
    this.socket.on('request', (payload, callback) => {
      this.processEventHandler('request', payload, handler, callback);
    });
  }

  public reconnectionFailed(
    handler: RepeaterServerEventHandler<RepeaterServerReconnectionFailedEvent>
  ): void {
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

  public errorOccurred(
    handler: RepeaterServerEventHandler<RepeaterServerErrorEvent, void>
  ): void {
    this.socket.on('error', (payload, callback) => {
      this.processEventHandler('error', payload, handler, callback);
    });
  }

  public reconnectionAttempted(
    handler: RepeaterServerEventHandler<RepeaterServerReconnectionAttemptedEvent>
  ): void {
    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.processEventHandler(
        'reconnect_attempt',
        { attempt, maxAttempts: this.MAX_RECONNECTION_ATTEMPTS },
        handler
      );
    });
  }

  public reconnectionSucceeded(
    handler: RepeaterServerEventHandler<void, void>
  ): void {
    this.socket.io.on('reconnect', () => {
      this.processEventHandler('reconnect', undefined, handler);
    });
  }

  private get socket() {
    if (!this._socket) {
      throw new Error(
        'Please make sure that repeater established a connection with host.'
      );
    }

    return this._socket;
  }

  private processEventHandler<P>(
    event: string,
    payload: P,
    handler: (payload: P) => unknown,
    callback?: unknown
  ) {
    Promise.resolve(handler(payload))
      .then((response) => {
        if (typeof callback !== 'function') {
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

  private createPingTimer() {
    this.clearPingTimer();

    this.timer = setInterval(
      () => this.socket.volatile.emit('ping'),
      10000
    ).unref();
  }

  private clearPingTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

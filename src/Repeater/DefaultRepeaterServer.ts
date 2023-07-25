import { logger } from '../Utils';
import {
  RepeaterServer,
  RepeaterServerEventHandler,
  RepeaterServerDeployedEvent,
  RepeaterServerEvents,
  RepeaterServerReconnectionFailedEvent,
  RepeaterServerEventHandlers
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
  private readonly DEFAULT_RECONNECT_TIMES = 3;
  private socket?: Socket;
  private timer?: Timer;

  constructor(
    @inject(DefaultRepeaterServerOptions)
    private readonly options: DefaultRepeaterServerOptions
  ) {}

  public disconnect() {
    this.clearPingTimer();

    this.socket?.disconnect();
    this.socket?.removeAllListeners();
    this.socket = undefined;
  }

  public async deploy(
    repeaterId?: string
  ): Promise<RepeaterServerDeployedEvent> {
    if (!this.socket) {
      throw new Error(
        'Please make sure that repeater established a connection with host.'
      );
    }

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
    this.socket = io(this.options.uri, {
      parser,
      path: '/api/ws/v1',
      transports: ['websocket'],
      reconnectionAttempts: this.DEFAULT_RECONNECT_TIMES,
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

  public on(
    event: RepeaterServerEvents,
    handler: RepeaterServerEventHandlers
  ): void {
    if (event === 'reconnection_failed') {
      this.onReconnectionFailed(
        handler as RepeaterServerEventHandler<RepeaterServerReconnectionFailedEvent>
      );
    } else {
      this.socket.on(event, (payload, callback) => {
        this.processEventHandler(event, payload, (p) => handler(p), callback);
      });
    }
  }

  private onReconnectionFailed<
    H extends RepeaterServerEventHandler<RepeaterServerReconnectionFailedEvent>
  >(handler: H) {
    this.socket.io.on('reconnect', () => {
      this.latestReconnectionError = undefined;
    });

    this.socket.io.on('reconnect_error', (error) => {
      this.latestReconnectionError = error;
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      logger.warn(
        'Failed to connect (attempt %d/%d)',
        attempt,
        this.DEFAULT_RECONNECT_TIMES
      );
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
    if (this.timer) {
      clearInterval(this.timer);
    }

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

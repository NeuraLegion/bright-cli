import { logger, ProxyFactory } from '../Utils';
import {
  DeployCommandOptions,
  DeploymentRuntime,
  RepeaterServer,
  RepeaterServerDeployedEvent,
  RepeaterServerErrorEvent,
  RepeaterServerEventHandler,
  RepeaterServerEvents,
  RepeaterServerEventsMap,
  RepeaterServerNetworkTestEvent,
  RepeaterServerNetworkTestResult,
  RepeaterServerReconnectionAttemptedEvent,
  RepeaterServerReconnectionFailedEvent,
  RepeaterServerRequestEvent,
  RepeaterServerRequestResponse,
  RepeaterServerScriptsUpdatedEvent,
  RepeaterUpgradeAvailableEvent
} from './RepeaterServer';
import { inject, injectable } from 'tsyringe';
import io, { Socket } from 'socket.io-client';
import parser from 'socket.io-msgpack-parser';
import { captureException, captureMessage } from '@sentry/node';
import { EventEmitter, once } from 'events';
import Timer = NodeJS.Timer;

export interface DefaultRepeaterServerOptions {
  readonly uri: string;
  readonly token: string;
  readonly connectTimeout?: number;
  readonly proxyUrl?: string;
  readonly insecure?: boolean;
}

export const DefaultRepeaterServerOptions: unique symbol = Symbol(
  'DefaultRepeaterServerOptions'
);

type CallbackFunction<T = unknown> = (arg: T) => unknown;
type HandlerFunction = (args: unknown[]) => unknown;

const enum SocketEvents {
  DEPLOYED = 'deployed',
  DEPLOY = 'deploy',
  UNDEPLOY = 'undeploy',
  UNDEPLOYED = 'undeployed',
  TEST_NETWORK = 'test-network',
  ERROR = 'error',
  UPDATE_AVAILABLE = 'update-available',
  SCRIPT_UPDATED = 'scripts-updated',
  PING = 'ping',
  REQUEST = 'request'
}

interface SocketListeningEventMap {
  [SocketEvents.DEPLOYED]: (event: RepeaterServerDeployedEvent) => void;
  [SocketEvents.UNDEPLOYED]: () => void;
  [SocketEvents.ERROR]: (event: RepeaterServerErrorEvent) => void;
  [SocketEvents.TEST_NETWORK]: (
    event: RepeaterServerNetworkTestEvent,
    callback: CallbackFunction<RepeaterServerNetworkTestResult>
  ) => void;
  [SocketEvents.UPDATE_AVAILABLE]: (
    event: RepeaterUpgradeAvailableEvent
  ) => void;
  [SocketEvents.SCRIPT_UPDATED]: (
    event: RepeaterServerScriptsUpdatedEvent
  ) => void;
  [SocketEvents.REQUEST]: (
    request: RepeaterServerRequestEvent,
    callback: CallbackFunction<RepeaterServerRequestResponse>
  ) => void;
}

interface SocketEmitEventMap {
  [SocketEvents.DEPLOY]: (
    options: DeployCommandOptions,
    runtime?: DeploymentRuntime
  ) => void;
  [SocketEvents.UNDEPLOY]: () => void;
  [SocketEvents.PING]: () => void;
}

@injectable()
export class DefaultRepeaterServer implements RepeaterServer {
  private readonly MAX_DEPLOYMENT_TIMEOUT = 60_000;
  private readonly MAX_PING_INTERVAL = 10_000;
  private readonly MAX_RECONNECTION_ATTEMPTS = 20;
  private readonly MAX_RECONNECTION_DELAY = 86_400_000;
  private readonly events = new EventEmitter();
  private readonly handlerMap = new WeakMap<
    RepeaterServerEventHandler<any>,
    HandlerFunction
  >();
  private latestReconnectionError?: Error;
  private timer?: Timer;
  private _socket?: Socket<SocketListeningEventMap, SocketEmitEventMap>;

  private get socket() {
    if (!this._socket) {
      throw new Error(
        'Please make sure that repeater established a connection with host.'
      );
    }

    return this._socket;
  }

  constructor(
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(DefaultRepeaterServerOptions)
    private readonly options: DefaultRepeaterServerOptions
  ) {}

  public disconnect() {
    this.events.removeAllListeners();
    this.clearPingTimer();

    this._socket?.disconnect();
    this._socket?.removeAllListeners();
    this._socket = undefined;
  }

  public async deploy(
    options: DeployCommandOptions,
    runtime: DeploymentRuntime
  ): Promise<RepeaterServerDeployedEvent> {
    process.nextTick(() =>
      this.socket.emit(SocketEvents.DEPLOY, options, runtime)
    );

    const [result]: RepeaterServerDeployedEvent[] = await Promise.race([
      once(this.socket, SocketEvents.DEPLOYED),
      new Promise<never>((_, reject) =>
        setTimeout(
          reject,
          this.MAX_DEPLOYMENT_TIMEOUT,
          new Error('No response.')
        ).unref()
      )
    ]);

    this.createPingTimer();

    return result;
  }

  public async connect(hostname: string) {
    this._socket = io(this.options.uri, {
      parser,
      path: '/api/ws/v1',
      transports: ['websocket'],
      reconnectionDelayMax: this.MAX_RECONNECTION_DELAY,
      timeout: this.options?.connectTimeout,
      rejectUnauthorized: !this.options.insecure,
      // @ts-expect-error Type is wrong.
      // Agent is passed directly to "ws" package, which accepts http.Agent
      agent: this.options.proxyUrl
        ? this.proxyFactory.createProxyForClient({
            proxyUrl: this.options.proxyUrl,
            targetUrl: this.options.uri,
            rejectUnauthorized: !this.options.insecure
          })
        : undefined,
      reconnectionAttempts: this.MAX_RECONNECTION_ATTEMPTS,
      auth: {
        token: this.options.token,
        domain: hostname
      }
    });

    this.listenToReservedEvents();
    this.listenToApplicationEvents();

    await Promise.race([
      once(this.socket, 'connect'),
      once(this.socket, 'connect_error').then(([error]: Error[]) => {
        throw error;
      })
    ]);

    logger.debug('Repeater connected to %s', this.options.uri);
  }

  public off<K extends keyof RepeaterServerEventsMap>(
    event: K,
    handler?: RepeaterServerEventHandler<K>
  ): void {
    const wrappedHandler = this.handlerMap.get(handler);
    if (wrappedHandler) {
      this.events.off(event, wrappedHandler);
      this.handlerMap.delete(handler);
    }
  }

  public on<K extends keyof RepeaterServerEventsMap>(
    event: K,
    handler: RepeaterServerEventHandler<K>
  ): void {
    const wrappedHandler = (...args: unknown[]) =>
      this.wrapEventListener(event, handler, ...args);
    this.handlerMap.set(handler, wrappedHandler);
    this.events.on(event, wrappedHandler);
  }

  private listenToApplicationEvents() {
    this.socket.on(SocketEvents.DEPLOYED, (event) =>
      this.events.emit(RepeaterServerEvents.DEPLOY, event)
    );
    this.socket.on(SocketEvents.REQUEST, (event, callback) =>
      this.events.emit(RepeaterServerEvents.REQUEST, event, callback)
    );
    this.socket.on(SocketEvents.TEST_NETWORK, (event, callback) =>
      this.events.emit(RepeaterServerEvents.TEST_NETWORK, event, callback)
    );
    this.socket.on(SocketEvents.ERROR, (event) => {
      captureMessage(event.message);
      this.events.emit(RepeaterServerEvents.ERROR, event);
    });
    this.socket.on(SocketEvents.UPDATE_AVAILABLE, (event) =>
      this.events.emit(RepeaterServerEvents.UPDATE_AVAILABLE, event)
    );
    this.socket.on(SocketEvents.SCRIPT_UPDATED, (event) =>
      this.events.emit(RepeaterServerEvents.SCRIPTS_UPDATED, event)
    );
  }

  private listenToReservedEvents() {
    this.socket.on('connect', () =>
      this.events.emit(RepeaterServerEvents.CONNECTED)
    );
    this.socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        this.events.emit(RepeaterServerEvents.DISCONNECTED);
      }

      // the disconnection was initiated by the server, you need to reconnect manually
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });
    this.socket.io.on('reconnect', () => {
      this.latestReconnectionError = undefined;
    });
    this.socket.io.on(
      'reconnect_error',
      (error) => (this.latestReconnectionError = error)
    );
    this.socket.io.on('reconnect_failed', () =>
      this.events.emit(RepeaterServerEvents.RECONNECTION_FAILED, {
        error: this.latestReconnectionError
      } as RepeaterServerReconnectionFailedEvent)
    );
    this.socket.io.on('reconnect_attempt', (attempt) =>
      this.events.emit(RepeaterServerEvents.RECONNECT_ATTEMPT, {
        attempt,
        maxAttempts: this.MAX_RECONNECTION_ATTEMPTS
      } as RepeaterServerReconnectionAttemptedEvent)
    );
    this.socket.io.on('reconnect', () =>
      this.events.emit(RepeaterServerEvents.RECONNECTION_SUCCEEDED)
    );
  }

  private async wrapEventListener<TArgs extends TArg[], TArg>(
    event: string,
    handler: (...payload: TArgs) => unknown,
    ...args: unknown[]
  ) {
    try {
      const callback = this.extractLastArgument(args);

      // eslint-disable-next-line @typescript-eslint/return-await
      const response = await handler(...(args as TArgs));

      callback?.(response);
    } catch (err) {
      this.handleEventError(err, event, args);
    }
  }

  private extractLastArgument(args: unknown[]): CallbackFunction | undefined {
    const lastArg = args.pop();
    if (typeof lastArg === 'function') {
      return lastArg as CallbackFunction;
    } else {
      // If the last argument is not a function, add it back to the args array
      args.push(lastArg);

      return undefined;
    }
  }

  private handleEventError(error: Error, event: string, args: unknown[]): void {
    captureException(error);
    logger.debug(
      'An error occurred while processing the %s event with the following payload: %j',
      event,
      args
    );
    logger.error(error);
  }

  private createPingTimer() {
    this.clearPingTimer();

    this.timer = setInterval(
      () => this.socket.volatile.emit(SocketEvents.PING),
      this.MAX_PING_INTERVAL
    ).unref();
  }

  private clearPingTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

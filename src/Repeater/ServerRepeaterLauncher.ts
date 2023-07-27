import { RepeaterLauncher } from './RepeaterLauncher';
import {
  RepeaterServer,
  RepeaterServerReconnectionFailedEvent,
  RepeaterServerRequestEvent
} from './RepeaterServer';
import { ScriptLoader } from '../Scripts';
import { StartupManagerFactory } from '../StartupScripts';
import {
  Certificates,
  Request,
  RequestExecutor,
  Response
} from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import { CliInfo } from '../Config';
import { delay, inject, injectAll, injectable } from 'tsyringe';

@injectable()
export class ServerRepeaterLauncher implements RepeaterLauncher {
  private static SERVICE_NAME = 'bright-repeater';
  private repeaterId: string | undefined;
  private repeaterStarted: boolean = false;

  constructor(
    @inject(RepeaterServer) private readonly repeaterServer: RepeaterServer,
    @inject(StartupManagerFactory)
    private readonly startupManagerFactory: StartupManagerFactory,
    @inject(Certificates) private readonly certificates: Certificates,
    @inject(ScriptLoader) private readonly scriptLoader: ScriptLoader,
    @inject(delay(() => CliInfo)) private readonly info: CliInfo,
    @injectAll(RequestExecutor)
    private readonly requestExecutors: RequestExecutor[]
  ) {}

  public compileScripts() {
    // Not supported
    return;
  }

  public close() {
    this.repeaterStarted = false;
    this.repeaterServer.disconnect();

    return Promise.resolve();
  }

  public async install(): Promise<void> {
    const { command, args: execArgs } = Helpers.getExecArgs({
      escape: false,
      include: ['--run'],
      exclude: ['--daemon', '-d']
    });

    const startupManager = this.startupManagerFactory.create({
      dispose: () => this.close()
    });

    await startupManager.install({
      command,
      args: execArgs,
      name: ServerRepeaterLauncher.SERVICE_NAME,
      displayName: 'Bright Repeater'
    });

    logger.log(
      'A Repeater daemon process was initiated successfully (SERVICE: %s)',
      ServerRepeaterLauncher.SERVICE_NAME
    );
  }

  public loadCerts(cacert: string): Promise<void> {
    return this.certificates.load(cacert);
  }

  public loadScripts(scripts: Record<string, string>): Promise<void> {
    return this.scriptLoader.load(scripts);
  }

  public async uninstall(): Promise<void> {
    const startupManager = this.startupManagerFactory.create({
      dispose: () => this.close()
    });

    await startupManager.uninstall(ServerRepeaterLauncher.SERVICE_NAME);

    logger.log(
      'The Repeater daemon process (SERVICE: %s) was stopped and deleted successfully',
      ServerRepeaterLauncher.SERVICE_NAME
    );
  }

  public async run(
    repeaterId: string,
    asDaemon: boolean = false
  ): Promise<void> {
    if (this.repeaterStarted) {
      return;
    }

    if (asDaemon) {
      const startupManager = this.startupManagerFactory.create({
        dispose: () => this.close()
      });
      await startupManager.run();
    }

    logger.log('Starting the Repeater (%s)...', this.info.version);

    this.repeaterServer.connect(repeaterId);

    this.subscribeToEvents();

    const result = await this.repeaterServer.deploy(repeaterId);

    this.repeaterId = result.repeaterId;

    this.repeaterStarted = true;

    logger.log(
      `The Repeater (%s) started. Repeater id is %s`,
      this.info.version,
      this.repeaterId
    );
  }

  private subscribeToEvents() {
    this.repeaterServer.errorOccurred(({ message }) => {
      logger.error(message);
    });
    this.repeaterServer.reconnectionFailed((payload) =>
      this.reconnectionFailed(payload)
    );
    this.repeaterServer.requestReceived((payload) =>
      this.requestReceived(payload)
    );
  }

  private reconnectionFailed({ error }: RepeaterServerReconnectionFailedEvent) {
    logger.error(error.message);
    this.close().catch(logger.error);
    process.exit(1);
  }

  private async requestReceived(event: RepeaterServerRequestEvent) {
    const { protocol } = event;

    const requestExecutor = this.requestExecutors.find(
      (x) => x.protocol === protocol
    );

    if (!requestExecutor) {
      throw new Error(`Unsupported protocol "${protocol}"`);
    }

    const response: Response = await requestExecutor.execute(
      new Request({ ...event })
    );

    const { statusCode, message, errorCode, body, headers } = response;

    return {
      protocol,
      body,
      headers,
      statusCode,
      errorCode,
      message
    };
  }
}

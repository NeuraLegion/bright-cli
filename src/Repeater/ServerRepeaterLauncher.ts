import { RepeaterLauncher } from './RepeaterLauncher';
import {
  RepeaterServer,
  RepeaterServerNetworkTestEvent,
  RepeaterServerReconnectionFailedEvent,
  RepeaterServerRequestEvent
} from './RepeaterServer';
import { ScriptLoader } from '../Scripts';
import { StartupManager } from '../StartupScripts';
import { Certificates, Request } from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import { CliInfo } from '../Config';
import { RepeaterCommandHub } from './RepeaterCommandHub';
import { delay, inject, injectable } from 'tsyringe';

@injectable()
export class ServerRepeaterLauncher implements RepeaterLauncher {
  private static SERVICE_NAME = 'bright-repeater';
  private repeaterStarted: boolean = false;

  constructor(
    @inject(RepeaterServer) private readonly repeaterServer: RepeaterServer,
    @inject(StartupManager)
    private readonly startupManager: StartupManager,
    @inject(RepeaterCommandHub)
    private readonly commandHub: RepeaterCommandHub,
    @inject(Certificates) private readonly certificates: Certificates,
    @inject(ScriptLoader) private readonly scriptLoader: ScriptLoader,
    @inject(delay(() => CliInfo)) private readonly info: CliInfo
  ) {}

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

    await this.startupManager.install({
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
    await this.startupManager.uninstall(ServerRepeaterLauncher.SERVICE_NAME);

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
      await this.startupManager.run(() => this.close());
    }

    logger.log('Starting the Repeater (%s)...', this.info.version);

    this.repeaterServer.connect(repeaterId);

    this.subscribeToEvents();

    await this.repeaterServer.deploy({
      repeaterId
    });

    this.repeaterStarted = true;

    logger.log(`The Repeater (%s) started`, this.info.version);
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
    this.repeaterServer.networkTesting((payload) =>
      this.testingNetwork(payload)
    );
    this.repeaterServer.scriptsUpdated((payload) =>
      this.commandHub.compileScripts(payload.script)
    );
    this.repeaterServer.reconnectionAttempted(({ attempt, maxAttempts }) =>
      logger.warn('Failed to connect (attempt %d/%d)', attempt, maxAttempts)
    );
    this.repeaterServer.reconnectionSucceeded(() =>
      logger.log('Repeater connected')
    );
  }

  private reconnectionFailed({ error }: RepeaterServerReconnectionFailedEvent) {
    logger.error(error.message);
    this.close().catch(logger.error);
    process.exit(1);
  }

  private async testingNetwork(event: RepeaterServerNetworkTestEvent) {
    try {
      const output = await this.commandHub.testNetwork(event.type, event.input);

      return {
        output
      };
    } catch (e) {
      return {
        error: typeof e === 'string' ? e : (e as Error).message
      };
    }
  }

  private async requestReceived(event: RepeaterServerRequestEvent) {
    const response = await this.commandHub.sendRequest(
      new Request({ ...event })
    );

    const { statusCode, message, errorCode, body, headers, protocol } =
      response;

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

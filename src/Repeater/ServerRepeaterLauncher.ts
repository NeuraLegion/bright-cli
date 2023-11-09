import { RepeaterLauncher } from './RepeaterLauncher';
import {
  DeploymentRuntime,
  RepeaterServer,
  RepeaterServerNetworkTestEvent,
  RepeaterServerReconnectionFailedEvent,
  RepeaterServerRequestEvent
} from './RepeaterServer';
import { RuntimeDetector } from './RuntimeDetector';
import { ScriptLoader, VirtualScripts } from '../Scripts';
import { StartupManager } from '../StartupScripts';
import { Certificates, Request } from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import { CliInfo } from '../Config';
import { RepeaterCommandHub } from './RepeaterCommandHub';
import { delay, inject, injectable } from 'tsyringe';
import chalk from 'chalk';
import { captureException } from '@sentry/node';

@injectable()
export class ServerRepeaterLauncher implements RepeaterLauncher {
  private static SERVICE_NAME = 'bright-repeater';
  private repeaterStarted: boolean = false;
  private repeaterRunning: boolean = false;
  private repeaterId: string | undefined;

  constructor(
    @inject(RuntimeDetector) private readonly runtimeDetector: RuntimeDetector,
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
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
    this.repeaterRunning = false;
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
    if (this.repeaterRunning) {
      return;
    }

    this.repeaterRunning = true;

    if (asDaemon) {
      await this.startupManager.run(() => this.close());
    }

    logger.log('Starting the Repeater (%s)...', this.info.version);

    this.repeaterId = repeaterId;
    this.repeaterServer.connect(repeaterId);
    this.subscribeToEvents();
  }

  private getRuntime(): DeploymentRuntime {
    return {
      version: this.info.version,
      scriptsLoaded: !!this.virtualScripts.size,
      ci: this.runtimeDetector.ci(),
      os: this.runtimeDetector.os(),
      arch: this.runtimeDetector.arch(),
      docker: this.runtimeDetector.isInsideDocker(),
      distribution: this.runtimeDetector.distribution(),
      nodeVersion: this.runtimeDetector.nodeVersion()
    };
  }

  private subscribeToEvents() {
    this.repeaterServer.connected(async () => {
      await this.repeaterServer.deploy(
        {
          repeaterId: this.repeaterId
        },
        this.getRuntime()
      );

      if (!this.repeaterStarted) {
        this.repeaterStarted = true;

        logger.log('The Repeater (%s) started', this.info.version);
      }
    });
    this.repeaterServer.errorOccurred(({ message }) => {
      logger.error(`%s: %s`, chalk.red('(!) CRITICAL'), message);
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
    this.repeaterServer.upgradeAvailable((payload) =>
      logger.warn(
        '%s: A new Repeater version (%s) is available, for update instruction visit https://docs.brightsec.com/docs/installation-options',
        chalk.yellow('(!) IMPORTANT'),
        payload.version
      )
    );
    this.repeaterServer.reconnectionAttempted(({ attempt, maxAttempts }) =>
      logger.warn('Failed to connect (attempt %d/%d)', attempt, maxAttempts)
    );
    this.repeaterServer.reconnectionSucceeded(() =>
      logger.log('The Repeater (%s) connected', this.info.version)
    );
  }

  private reconnectionFailed({ error }: RepeaterServerReconnectionFailedEvent) {
    captureException(error);
    logger.error(error);
    this.close().catch(logger.error);
    process.exitCode = 1;
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

    const {
      statusCode,
      message,
      errorCode,
      body,
      headers,
      protocol,
      encoding
    } = response;

    return {
      protocol,
      body,
      headers,
      statusCode,
      errorCode,
      message,
      encoding
    };
  }
}

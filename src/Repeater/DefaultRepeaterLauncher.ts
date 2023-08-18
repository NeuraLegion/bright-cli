import { RepeaterLauncher } from './RepeaterLauncher';
import { Bus } from '../Bus';
import { ScriptLoader, VirtualScripts } from '../Scripts';
import { StartupManager } from '../StartupScripts';
import { Certificates } from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import {
  NetworkTestHandler,
  RegisterScriptsHandler,
  RepeaterRegistered,
  RepeaterRegistering,
  RepeaterRegisteringError,
  RepeaterStatusUpdated,
  SendRequestHandler
} from '../Handlers';
import { CliInfo } from '../Config';
import { RepeaterCommandHub } from './RepeaterCommandHub';
import { gt } from 'semver';
import chalk from 'chalk';
import { delay, inject, injectable } from 'tsyringe';
import Timer = NodeJS.Timer;

@injectable()
export class DefaultRepeaterLauncher implements RepeaterLauncher {
  private static SERVICE_NAME = 'bright-repeater';
  private timer: Timer | undefined;
  private repeaterId: string | undefined;
  private repeaterStarted: boolean = false;

  constructor(
    @inject(Bus) private readonly bus: Bus,
    @inject(RepeaterCommandHub) private readonly commandHub: RepeaterCommandHub,
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
    @inject(StartupManager)
    private readonly startupManager: StartupManager,
    @inject(Certificates) private readonly certificates: Certificates,
    @inject(ScriptLoader) private readonly scriptLoader: ScriptLoader,
    @inject(delay(() => CliInfo)) private readonly info: CliInfo
  ) {
    this.bus.onReconnectionFailure(async (e: Error) => {
      logger.error(e.message);
      await this.close();
      process.exit(1);
    });
  }

  public async close(): Promise<void> {
    clearInterval(this.timer);
    if (this.repeaterStarted) {
      await this.bus.publish(
        new RepeaterStatusUpdated(this.repeaterId, 'disconnected')
      );
      this.repeaterStarted = false;
    }
    await this.bus.destroy();
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
      name: DefaultRepeaterLauncher.SERVICE_NAME,
      displayName: 'Bright Repeater'
    });

    logger.log(
      'A Repeater daemon process was initiated successfully (SERVICE: %s)',
      DefaultRepeaterLauncher.SERVICE_NAME
    );
  }

  public loadCerts(cacert: string): Promise<void> {
    return this.certificates.load(cacert);
  }

  public loadScripts(scripts: Record<string, string>): Promise<void> {
    return this.scriptLoader.load(scripts);
  }

  public async uninstall(): Promise<void> {
    await this.startupManager.uninstall(DefaultRepeaterLauncher.SERVICE_NAME);

    logger.log(
      'The Repeater daemon process (SERVICE: %s) was stopped and deleted successfully',
      DefaultRepeaterLauncher.SERVICE_NAME
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
    logger.warn(
      'WARNING: You are using the legacy flow. Consider using the new repeater that utilizes standard ports.'
    );

    this.repeaterId = repeaterId;

    await this.bus.init();

    const { payload }: RepeaterRegistered = await this.bus.send({
      payload: new RepeaterRegistering(
        repeaterId,
        this.info.version,
        !!this.virtualScripts.size
      )
    });

    if ('error' in payload) {
      this.statusChangeException(payload.error);
    } else {
      if (gt(payload.version, this.info.version)) {
        logger.warn(
          '%s: A new Repeater version (%s) is available, for update instruction visit https://docs.brightsec.com/docs/installation-options',
          chalk.yellow('(!) IMPORTANT'),
          payload.version
        );
      }

      if (payload.script) {
        this.commandHub.compileScripts(payload.script);
      }
    }

    await this.subscribeToEvents();

    this.repeaterStarted = true;

    await this.bus.publish(
      new RepeaterStatusUpdated(this.repeaterId, 'connected')
    );

    logger.log(`The Repeater (%s) started`, this.info.version);
  }

  private async subscribeToEvents(): Promise<void> {
    await this.bus.subscribe(RegisterScriptsHandler);
    await this.bus.subscribe(NetworkTestHandler);
    await this.bus.subscribe(SendRequestHandler);
    this.timer = setInterval(
      () =>
        this.bus.publish(
          new RepeaterStatusUpdated(this.repeaterId, 'connected')
        ),
      10000
    );
    this.timer.unref();
  }

  private statusChangeException(error: RepeaterRegisteringError): never {
    switch (error) {
      case RepeaterRegisteringError.NOT_ACTIVE:
        throw new Error(`Access Refused: The current Repeater is not active.`);
      case RepeaterRegisteringError.NOT_FOUND:
        throw new Error(`Unauthorized access. Please check your credentials.`);
      case RepeaterRegisteringError.BUSY:
        throw new Error(
          `Access Refused: There is an already running Repeater with ID ${this.repeaterId}`
        );
      case RepeaterRegisteringError.REQUIRES_TO_BE_UPDATED:
        throw new Error(
          `${chalk.red(
            '(!) CRITICAL'
          )}: The current running version is no longer supported`
        );
    }
  }
}

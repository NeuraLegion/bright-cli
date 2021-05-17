import { RepeaterLauncher } from './RepeaterLauncher';
import { Bus } from '../Bus';
import { ScriptLoader, VirtualScripts, VirtualScriptType } from '../Scripts';
import { StartupManagerFactory } from '../StartupScripts';
import { Certificates } from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import {
  NetworkTestHandler,
  RegisterScriptsHandler,
  RepeaterRegistered,
  RepeaterRegistering,
  RepeaterStatusUpdated,
  SendRequestHandler
} from '../Handlers';
import { CliInfo } from '../Config';
import { eq, gt, major } from 'semver';
import chalk from 'chalk';
import { delay, inject, injectable } from 'tsyringe';
import Timer = NodeJS.Timer;

@injectable()
export class DefaultRepeaterLauncher implements RepeaterLauncher {
  private static SERVICE_NAME = 'nexploit-repeater';
  private timer: Timer | undefined;
  private repeaterId: string | undefined;

  constructor(
    @inject(Bus) private readonly bus: Bus,
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
    @inject(StartupManagerFactory)
    private readonly startupManagerFactory: StartupManagerFactory,
    @inject(Certificates) private readonly certificates: Certificates,
    @inject(ScriptLoader) private readonly scriptLoader: ScriptLoader,
    @inject(delay(() => CliInfo)) private readonly info: CliInfo
  ) {}

  public async close(): Promise<void> {
    clearInterval(this.timer);
    await this.bus.publish(
      new RepeaterStatusUpdated(this.repeaterId, 'disconnected')
    );
    await this.bus.destroy();
  }

  public async install(): Promise<void> {
    const { command, args: execArgs } = Helpers.getExecArgs({
      exclude: ['--daemon', '-d'],
      include: ['--run']
    });

    const startupManager = this.startupManagerFactory.create({
      dispose: this.close.bind(this)
    });

    await startupManager.install({
      command,
      args: execArgs,
      name: DefaultRepeaterLauncher.SERVICE_NAME,
      displayName: 'NexPloit Repeater'
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

  public compileScripts(script: string | Record<string, string>): void {
    if (!script) {
      return;
    }

    this.virtualScripts.clear(VirtualScriptType.REMOTE);

    if (this.virtualScripts.size) {
      return;
    }

    if (typeof script === 'string') {
      this.virtualScripts.set('*', VirtualScriptType.REMOTE, script);
    } else {
      Object.entries(script).map(([wildcard, code]: [string, string]) =>
        this.virtualScripts.set(wildcard, VirtualScriptType.REMOTE, code)
      );
    }
  }

  public async uninstall(): Promise<void> {
    const startupManager = this.startupManagerFactory.create({
      dispose: this.close.bind(this)
    });

    await startupManager.uninstall(DefaultRepeaterLauncher.SERVICE_NAME);

    logger.log(
      'The Repeater daemon process (SERVICE: %s) was stopped and deleted successfully',
      DefaultRepeaterLauncher.SERVICE_NAME
    );
  }

  public async run(
    repeaterId: string,
    asDaemon: boolean = false
  ): Promise<void> {
    if (this.repeaterId) {
      return;
    }

    if (asDaemon) {
      const startupManager = this.startupManagerFactory.create({
        dispose: this.close.bind(this)
      });
      await startupManager.run();
    }

    logger.log('Starting the Repeater (%s)...', this.info.version);

    this.repeaterId = repeaterId;

    await this.bus.init();

    const {
      version,
      script,
      lastUsedVersion
    }: RepeaterRegistered = await this.bus.send({
      payload: new RepeaterRegistering(
        repeaterId,
        this.info.version,
        !!this.virtualScripts.size
      )
    });

    if (gt(version, this.info.version)) {
      logger.warn(
        '%s: A new Repeater version (%s) is available, for update instruction visit https://kb.neuralegion.com/#/guide/np-cli/installation',
        chalk.yellow('(!) IMPORTANT'),
        version
      );
    }

    if (major(version) > major(this.info.version)) {
      throw new Error(
        `${chalk.red(
          '(!) CRITICAL'
        )}: The current running version is no longer supported`
      );
    }

    if (!eq(lastUsedVersion, this.info.version)) {
      throw new Error(
        `Access Refused: There is an already running Repeater with ID ${repeaterId}, but with a different version`
      );
    }

    this.compileScripts(script);

    await this.subscribeToEvents();

    logger.log(`The Repeater (%s) started`, this.info.version);
  }

  private async subscribeToEvents() {
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
  }
}

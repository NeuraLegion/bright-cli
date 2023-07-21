import { RepeaterLauncher } from './RepeaterLauncher';
import {
  Repeater,
  RepeaterReconnectionFailedEvent,
  RepeaterRequestEvent
} from './Repeater';
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
export class DefaultRepeaterLauncher implements RepeaterLauncher {
  private static SERVICE_NAME = 'bright-repeater';
  private repeaterId: string | undefined;
  private repeaterStarted: boolean = false;

  constructor(
    @inject(Repeater) private readonly repeater: Repeater,
    @inject(StartupManagerFactory)
    private readonly startupManagerFactory: StartupManagerFactory,
    @inject(Certificates) private readonly certificates: Certificates,
    @inject(ScriptLoader) private readonly scriptLoader: ScriptLoader,
    @inject(delay(() => CliInfo)) private readonly info: CliInfo,
    @injectAll(RequestExecutor)
    private readonly requestExecutors: RequestExecutor[]
  ) {}

  public close() {
    this.repeaterStarted = false;
    this.repeater.disconnect();
  }

  public async install(): Promise<void> {
    const { command, args: execArgs } = Helpers.getExecArgs({
      escape: false,
      include: ['--run'],
      exclude: ['--daemon', '-d']
    });

    const startupManager = this.startupManagerFactory.create({
      dispose: this.close.bind(this)
    });

    await startupManager.install({
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
    repeaterId?: string,
    asDaemon: boolean = false
  ): Promise<void> {
    if (this.repeaterStarted) {
      return;
    }

    if (asDaemon) {
      const startupManager = this.startupManagerFactory.create({
        dispose: this.close.bind(this)
      });
      await startupManager.run();
    }

    logger.log('Starting the Repeater (%s)...', this.info.version);

    this.repeater.connect();

    this.repeater.on(
      'reconnection_failed',
      this.onReconnectionFailed.bind(this)
    );
    this.repeater.on('request', this.onRequest.bind(this));

    const result = await this.repeater.deploy(repeaterId);

    this.repeaterId = result.repeaterId;

    this.repeaterStarted = true;

    logger.log(
      `The Repeater (%s) started. Repeater id is %s`,
      this.info.version,
      this.repeaterId
    );
  }

  private onReconnectionFailed({
    error
  }: RepeaterReconnectionFailedEvent['request']) {
    logger.error(error.message);
    this.close();
    process.exit(1);
  }

  private async onRequest(event: RepeaterRequestEvent['request']) {
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

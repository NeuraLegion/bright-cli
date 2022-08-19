import { Platform, StartOptions } from '../Platform';
import { AUTH_TOKEN_VALIDATION_REGEXP } from '../Credentials';
import { ConnectivityAnalyzer, ConnectivityUrls } from '../Connectivity';
import { Helpers, logger } from '../../Utils';
import { TestType } from '../TestType';
import { Tokens } from '../Tokens';
import { inject, injectable } from 'tsyringe';
import readline from 'readline';
import { URL } from 'url';
import { EOL } from 'os';

@injectable()
export class ReadlinePlatform implements Platform {
  public static URLS_QUESTION =
    'Please enter the target URLs to test (separated by commas)';
  public static HOST_OR_IP_QUESTION =
    'Please enter the target hostname or IP to test';
  public static COMPELED_MESSAGE =
    'Communication diagnostics done, close the terminal to exit.';
  public static INTERNAL_DIAGNOSTIC = `Starting INTERNAL communication diagnostics:${EOL}`;

  private rl: readline.Interface;
  private readonly delimiter = `${EOL}\r--${EOL}`;

  constructor(
    @inject(ConnectivityUrls) private readonly urls: ReadonlyMap<TestType, URL>,
    @inject(Tokens) private readonly tokens: Tokens,
    @inject(ConnectivityAnalyzer)
    private readonly connectivityService: ConnectivityAnalyzer
  ) {}

  public async start(options?: StartOptions): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    if (options?.traceroute) {
      await this.processTraceroute();
    } else {
      await this.configure(options);
    }

    // eslint-disable-next-line no-console
    console.log(this.delimiter);

    // eslint-disable-next-line no-console
    console.log(ReadlinePlatform.COMPELED_MESSAGE);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async stop(): Promise<void> {
    this.rl.close();
  }

  private async configure(options?: StartOptions): Promise<void> {
    if (!options?.ping) {
      /* eslint-disable no-console */
      console.log(`Welcome to the Bright Network Testing wizard!${EOL}`);

      console.log(
        'Note: To run the test, you will require a `Repeater ID` and an `Repeater Token` with the correct scopes.'
      );

      console.log(
        'If you are running the configuration as part of a POC, both of these should have been sent to you via your sales contact.'
      );

      process.stdout.write(EOL);

      await this.requestTokens();

      console.log(this.delimiter);

      await this.processExternalCommunication();

      console.log(this.delimiter);
      /* eslint-enable no-console */
    }

    await this.processPing();
  }

  private async requestTokens(): Promise<void> {
    const repeaterId = await this.question('Please enter your Repeater ID');
    const authToken = await this.question(
      `Please enter your Repeater API Token`
    );

    process.stdout.write(EOL);

    if (!authToken || !AUTH_TOKEN_VALIDATION_REGEXP.test(authToken)) {
      // eslint-disable-next-line no-console
      console.error('Invalid value for authentication token');

      return;
    }

    if (!repeaterId) {
      // eslint-disable-next-line no-console
      console.error('Invalid value for repeater id');

      return;
    }

    await this.tokens.writeTokens({ repeaterId, authToken });
  }

  private processConnectivity(type: TestType): Promise<void> {
    const url = this.urls.get(type);

    return this.process(
      `Validating that the connection to ${url.host} at port ${url.port} is open`,
      () => this.connectivityService.verifyAccess(type, url)
    );
  }

  private async processExternalCommunication(): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`Starting EXTERNAL communication diagnostics:${EOL}`);

    await this.processConnectivity(TestType.TCP);

    await this.processConnectivity(TestType.HTTP);

    await this.process('Verifying provided Token and Repeater ID', () =>
      this.connectivityService.verifyAccess(TestType.AUTH)
    );

    process.stdout.write(EOL);

    // eslint-disable-next-line no-console
    console.log('EXTERNAL communication diagnostics completed.');
  }

  private async processPing(): Promise<void> {
    /* eslint-disable no-console */
    console.log(
      `Next step is to validate the connection to your INTERNAL (local) target application(s).${EOL}`
    );
    const urls = this.getDelimitedInput(
      await this.question(ReadlinePlatform.URLS_QUESTION),
      ','
    );

    console.log(this.delimiter);

    console.log(ReadlinePlatform.INTERNAL_DIAGNOSTIC);

    let reachedCount = 0;

    await Helpers.pool(250, urls, (url: string) =>
      this.process(`Trying to reach ${url}`, async () => {
        const result = await this.connectivityService.verifyAccess(
          TestType.HTTP,
          new URL(url)
        );

        reachedCount += Number(result);

        return result;
      })
    );

    process.stdout.write(EOL);

    console.log('INTERNAL communication diagnostics completed.');
    console.log(
      `${urls.length - reachedCount} out of ${
        urls.length
      } URLs could not be reached.`
    );
    /* eslint-enable no-console */
  }

  private async processTraceroute(): Promise<void> {
    /* eslint-disable no-console */
    console.log(
      `Traceroute to your INTERNAL (local) target application.${EOL}`
    );

    if (process.platform === 'win32') {
      console.log(
        `Note: Some Windows users might need to allow the ICMP network traffic through a firewall to enable this functionality.
      For more information, see: https://docs.brightsec.com/docs/testing-network-connectivity${EOL}`
      );
    }

    const target = await this.question(ReadlinePlatform.HOST_OR_IP_QUESTION);

    console.log(this.delimiter);

    console.log(ReadlinePlatform.INTERNAL_DIAGNOSTIC);

    const result = await this.connectivityService.verifyAccess(
      TestType.TRACEROUTE,
      target
    );

    process.stdout.write(EOL);

    console.log(`Traceroute ${result ? 'completed' : 'failed'}.`);
    /* eslint-enable no-console */
  }

  private async question(question: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(`${question}: `, resolve));
  }

  private async process(
    text: string,
    handler?: () => Promise<boolean>
  ): Promise<void> {
    process.stdout.write(`${text}...`);
    readline.cursorTo(process.stdout, 0);

    let result: boolean;

    try {
      result = await handler();
    } catch (err) {
      logger.debug(err.message);
      result = false;
    }

    // eslint-disable-next-line no-console
    console.log(`${text}... ${result ? 'Success' : 'Failed'}`);
  }

  private getDelimitedInput(
    value: string,
    delimiter: string | RegExp
  ): string[] {
    const inputVal = (value ?? '').trim();

    return inputVal
      ? inputVal
          .split(delimiter)
          .map((x: string) => x.trim())
          .filter(Boolean)
      : [];
  }
}

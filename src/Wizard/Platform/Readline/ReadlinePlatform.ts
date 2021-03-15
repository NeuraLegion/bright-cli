import { Platform, StartOptions } from '../Platform';
import { AUTH_TOKEN_VALIDATION_REGEXP, TestType } from '../../Models';
import { Tokens } from '../../Tokens';
import { ConnectivityAnalyzer, ConnectivityUrls } from '../../Services';
import { Helpers } from '../../../Utils';
import { inject, injectable } from 'tsyringe';
import readline from 'readline';
import { URL } from 'url';
import { EOL } from 'os';

@injectable()
export class ReadlinePlatform implements Platform {
  public static URL_QUESTION =
    'Please enter the target URLs to test (separated by commas)';
  public static COMPELED_MESSAGE =
    'Communication diagnostics done, close the terminal to exit.';

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
    await this.configure(options);
  }

  public async stop(): Promise<void> {
    this.rl.close();
  }

  private async configure(options?: StartOptions): Promise<void> {
    if (!options?.networkTestOnly) {
      console.log(`Welcome to the NexPloit Network Testing wizard!${EOL}`);

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
    }

    await this.processInternalCommunication();

    console.log(this.delimiter);

    console.log(ReadlinePlatform.COMPELED_MESSAGE);
  }

  private async requestTokens(): Promise<void> {
    const repeaterId = await this.question('Please enter your Repeater ID');
    const authToken = await this.question(
      `Please enter your Repeater API Token`
    );

    process.stdout.write(EOL);

    if (!authToken || !AUTH_TOKEN_VALIDATION_REGEXP.test(authToken)) {
      console.error('Invalid value for authentication token');

      return;
    }

    if (!repeaterId) {
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
    console.log(`Starting EXTERNAL communication diagnostics:${EOL}`);

    await this.processConnectivity(TestType.TCP);

    await this.processConnectivity(TestType.HTTP);

    await this.process('Verifying provided Token and Repeater ID', () =>
      this.connectivityService.verifyAccess(TestType.AUTH)
    );

    process.stdout.write(EOL);

    console.log('EXTERNAL communication diagnostics completed.');
  }

  private async processInternalCommunication(): Promise<void> {
    console.log(
      `Next step is to validate the connection to your INTERNAL (local) target application(s).${EOL}`
    );
    const urls = this.getDelimitedInput(
      await this.question(ReadlinePlatform.URL_QUESTION),
      ','
    );

    console.log(this.delimiter);

    console.log(`Starting INTERNAL communication diagnostics:${EOL}`);

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

    console.log('EXTERNAL communication diagnostics completed.');
    console.log(
      `${urls.length - reachedCount} out of ${
        urls.length
      } URLs could not be reached.`
    );
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
      result = false;
    }

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

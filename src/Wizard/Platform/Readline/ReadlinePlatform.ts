import { Platform } from '../Platform';
import { TestType } from '../../Models';
import { Tokens } from '../../Tokens';
import { DefaultConnectivityAnalyzer } from '../../Services';
import { inject, injectable } from 'tsyringe';
import readline from 'readline';
import { URL } from 'url';
import { EOL } from 'os';

@injectable()
export class ReadlinePlatform implements Platform {
  private rl: readline.Interface;
  private readonly delimiter = `${EOL}\r--${EOL}`;

  constructor(
    @inject(Tokens) private readonly tokens: Tokens,
    @inject(DefaultConnectivityAnalyzer)
    private readonly connectivityService: DefaultConnectivityAnalyzer
  ) {}

  public async start(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(`Welcome to the NexPloit Network Testing wizard!${EOL}`);

    await this.configure();
  }

  public async stop(): Promise<void> {
    this.rl.close();
  }

  private async configure(): Promise<void> {
    console.log(
      'Note: To run the test, you will require a `Repeater ID` and an `Repeater Token` with the correct scopes.'
    );
    console.log(
      'If you are running the configuration as part of a POC, both of these should have been sent to you via your sales contact.'
    );

    process.stdout.write(EOL);

    await this.processTokens();

    console.log(this.delimiter);

    await this.processExternalCommunication();

    console.log(this.delimiter);

    await this.processInternalCommunication();

    console.log(this.delimiter);
    console.log('Communication diagnostics done.');
  }

  private async processTokens(): Promise<void> {
    const repeaterId = await this.question('Please enter your Repeater ID');
    const authToken = await this.question(
      `Please enter your Repeater API Token`
    );

    process.stdout.write(EOL);

    await this.process(`Verifying provided Token and Repeater ID`, async () => {
      await this.tokens.writeTokens({ repeaterId, authToken });

      return true;
    });
  }

  private async processExternalCommunication(): Promise<void> {
    console.log(`Starting EXTERNAL communication diagnostics:${EOL}`);

    await this.process(
      'Validating that the connection to amq.nexploit.app at port 5672 is open',
      () => this.connectivityService.verifyAccess(TestType.AUTH)
    );
    await this.process(
      'Validating that the connection to nexploit.app at port 443 is open',
      () => this.connectivityService.verifyAccess(TestType.HTTP)
    );

    process.stdout.write(EOL);

    console.log('EXTERNAL communication diagnostics completed.');
  }

  private async processInternalCommunication(): Promise<void> {
    console.log(
      `Next step is to validate the connection to your INTERNAL (local) target application(s).${EOL}`
    );

    const urls = this.getDelimitedInput(
      await this.question(
        'Please enter the target URLs to test (separated by commas)'
      ),
      ','
    );

    console.log(this.delimiter);

    console.log(`Starting INTERNAL communication diagnostics:${EOL}`);

    let reachedCount = 0;

    for (const url of urls) {
      await this.process(`Trying to reach ${url}`, async () => {
        const result = await this.connectivityService.verifyAccess(
          TestType.HTTP,
          new URL(url)
        );

        reachedCount += result ? 1 : 0;

        return result;
      });
    }

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

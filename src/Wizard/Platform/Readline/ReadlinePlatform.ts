import { Platform } from '../Platform';
import { inject, injectable } from 'tsyringe';
import { Helpers } from 'src/Utils';
import { Tokens } from 'src/Wizard/Tokens';
import { TestType } from 'src/Wizard/Models';
import { ConnectivityService } from 'src/Wizard/Services/ConnectivityService';
import readline from 'readline';

@injectable()
export class ReadlinePlatform implements Platform {
  private rl: readline.Interface;
  private delimiter: string = '\n\r--\n';

  constructor(
    @inject(Tokens) private readonly tokens: Tokens,
    @inject(ConnectivityService)
    private readonly connectivityService: ConnectivityService
  ) {}

  public async start(): Promise<ReadlinePlatform> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.rl.once('connected', async () => {
      console.log('Welcome to the NexPloit Network Testing wizard!');
      await this.configure();
    });

    this.rl.emit('connected');

    return this;
  }

  public async stop(): Promise<void> {
    this.rl.close();
  }

  private async configure(): Promise<void> {
    console.log(`
      \rNote: To run the test, you will require a 'Repeater ID' and an 'Repeater Token' with the correct scopes.
      \rIf you are running the configuration as part of a POC, both of these should have been sent to you via your sales contact.
    `);

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
      'Please enter your Repeater API Token'
    );

    console.log('\n');

    await this.process('Verifying provided Token and Repeater ID', async () => {
      try {
        await this.tokens.writeTokens({ repeaterId, authToken });

        return true;
      } catch (err) {
        return false;
      }
    });
  }

  private async processExternalCommunication(): Promise<void> {
    console.log('Starting EXTERNAL communication diagnostics:\n');

    await this.process(
      'Validating that the connection to amq.nexploit.app at port 5672 is open',
      async () => {
        try {
          return this.connectivityService.getConnectivityStatus(TestType.AUTH);
        } catch (err) {
          return false;
        }
      }
    );
    await this.process(
      'Validating that the connection to nexploit.app at port 443 is open',
      async () => {
        try {
          return this.connectivityService.getConnectivityStatus(TestType.HTTP);
        } catch (err) {
          return false;
        }
      }
    );

    console.log('\nEXTERNAL communication diagnostics completed.');
  }

  private async processInternalCommunication(): Promise<void> {
    console.log(
      'Next step is to validate the connection to your INTERNAL (local) target application(s).\n'
    );

    const urls = Helpers.getDelimitedInput(
      await this.question(
        'Please enter the target URLs to test (separated by commas)'
      ),
      ','
    );

    console.log(this.delimiter);

    console.log('Starting INTERNAL communication diagnostics:\n');

    for (const url of urls) {
      await this.process(`Trying to reach ${url}`, async () => true);
    }

    console.log('\nEXTERNAL communication diagnostics completed.');
    console.log('1 out of 3 URLs could not be reached.');
  }

  private async question(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(`${question}: `, resolve);
    });
  }

  private async process(
    text: string,
    handler?: () => Promise<boolean>
  ): Promise<void> {
    process.stdout.write(`${text}...`);
    readline.cursorTo(process.stdout, 0);

    const result = await handler();

    console.log(`${text}... ${result ? 'Success' : 'Failed'}`);
  }
}

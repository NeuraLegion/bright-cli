import { CliConfig, ConfigReader } from './ConfigReader';
import { Bus, HandlerFactory, RabbitMQBus } from '../Bus';
import { DefaultRequestExecutor, RequestExecutor } from '../RequestExecutor';
import { DefaultConfigReader } from './DefaultConfigReader';
import { DefaultHandlerFactory, SendRequestHandler } from '../Handlers';
import { sync } from 'find-up';
import { Argv, CommandModule } from 'yargs';
import { Container, interfaces } from 'inversify';
import path from 'path';

export class CliBuilder {
  private container?: Container;
  private configReader?: ConfigReader;

  private _cwd: string;

  get cwd(): string {
    return this._cwd;
  }

  constructor({
    cwd = process.cwd(),
    colors = false
  }: {
    cwd: string;
    colors: boolean;
  }) {
    this._cwd = this.guessCWD(cwd);
    if (colors) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('yargonaut')
        .style('blue')
        .style('yellow', 'required')
        .helpStyle('green')
        .errorsStyle('red');
    }

    this.resolveDeps();
  }

  public build({ commands }: { commands: CommandModule[] }): Argv {
    const config: CliConfig = this.configReader.toJSON();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli: Argv = require('yargs')
      .usage('Usage: $0 <command> [options] [<file | scan>]')
      .pkgConf('nexploit', this._cwd)
      .example(
        '$0 archive:generate --mockfile=.mockfile --name=archive.har',
        'output har file on base your mock requests'
      )
      .config(config);

    return commands
      .reduce((acc: Argv, item: CommandModule) => acc.command(item), cli)
      .recommendCommands()
      .demandCommand(1)
      .strict(false)
      .alias('v', 'version')
      .help('help')
      .alias('h', 'help');
  }

  private resolveDeps(): void {
    this.configure();

    this.container.bind<Bus>(Bus).to(RabbitMQBus);

    const agentMode =
      this.configReader.has('agent') && this.configReader.has('bus');

    if (agentMode) {
      this.container.bind<Bus>(Bus).toDynamicValue(
        (context: interfaces.Context) =>
          new RabbitMQBus(
            {
              url: this.configReader.get('bus'),
              proxyUrl: this.configReader.get('proxy'),
              clientQueue: `agent:${this.configReader.get('agent')}`,
              exchange: 'event-bus',
              deadLetterExchange: 'dead-letter',
              deadLetterQueue: 'dl'
            },
            context.container.get(HandlerFactory)
          )
      );
    }
    this.container
      .bind<RequestExecutor>(RequestExecutor)
      .to(DefaultRequestExecutor);
    this.container
      .bind<HandlerFactory>(HandlerFactory)
      .toDynamicValue(
        (context: interfaces.Context) =>
          new DefaultHandlerFactory(context.container)
      );
    this.container.bind(SendRequestHandler).toSelf();
  }

  private configure(): void {
    this.container = new Container();

    this.container.bind<ConfigReader>(ConfigReader).to(DefaultConfigReader);

    this.configReader = this.container.get(ConfigReader);

    this.configReader.load(this.cwd);
  }

  private guessCWD(cwd: string): string {
    cwd = cwd || process.env.NEXPLOIT_CWD || process.cwd();

    const pkgPath: string | null = sync('package.json', { cwd });

    if (pkgPath) {
      cwd = path.dirname(pkgPath);
    }

    return cwd;
  }
}

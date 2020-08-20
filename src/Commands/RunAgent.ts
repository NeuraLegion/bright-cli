import { Bus, RabbitMQBus } from '../Bus';
import { DefaultHandlerRegistry, SendRequestHandler } from '../Handlers';
import { DefaultRequestExecutor } from '../RequestExecutor';
import { Helpers } from '../Utils/Helpers';
import logger from '../Utils/Logger';
import { Arguments, Argv, CommandModule } from 'yargs';

export class RunAgent implements CommandModule {
  public readonly command = 'agent';
  public readonly describe = 'Starts an agent by its ID.';

  public builder(args: Argv): Argv {
    return args
      .option('api', {
        default: 'https://nexploit.app/',
        hidden: true,
        describe: 'NexPloit base url'
      })
      .option('bus', {
        default: 'amqps://amq.nexploit.app:5672',
        hidden: true,
        describe: 'NexPloit Event Bus'
      })
      .option('api-key', {
        alias: 'K',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('id', {
        describe:
          'ID of an existing agent which you want to use to run a new scan.',
        type: 'string',
        demandOption: true
      })
      .option('header', {
        alias: 'H',
        requiresArg: true,
        conflicts: ['headers'],
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .option('headers', {
        requiresArg: true,
        conflicts: ['header'],
        default: '{}',
        describe:
          'JSON string which contains header list, which is initially empty and consists of zero or more name and value pairs.'
      })
      .option('proxy', {
        describe: 'SOCKS4 or SOCKS5 url to proxy all traffic'
      })
      .env('AGENT')
      .exitProcess(false);
  }

  public async handler(args: Arguments): Promise<void> {
    let bus: Bus;
    try {
      const stop: () => Promise<void> = async (): Promise<void> => {
        await bus.destroy();
        process.exit(0);
      };
      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);

      const headers: Record<string, string> = (args.header as string[])?.length
        ? Helpers.parseHeaders(args.header as string[])
        : JSON.parse(args.headers as string);

      const requestExecutor = new DefaultRequestExecutor({
        headers,
        timeout: 5000,
        maxRedirects: 20,
        proxyUrl: args.proxy as string
      });
      const handlerRegistry = new DefaultHandlerRegistry(requestExecutor);

      bus = new RabbitMQBus(
        {
          exchange: 'EventBus',
          clientQueue: `agent:${args.id as string}`,
          connectTimeout: 10000,
          url: args.bus as string,
          proxyUrl: args.proxy as string,
          credentials: {
            username: args.id as string,
            password: args.apiKey as string
          }
        },
        handlerRegistry
      );

      await bus.init();

      await bus.subscribe(SendRequestHandler);
    } catch (e) {
      logger.error(`Error during "agent": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

import { Bus, RabbitMQBus } from '../Bus';
import { DefaultHandlerRegistry, SendRequestHandler } from '../Handlers';
import { DefaultRequestExecutor } from '../RequestExecutor';
import { Helpers } from '../Utils/Helpers';
import logger from '../Utils/Logger';
import { Arguments, Argv, CommandModule } from 'yargs';

const onError = (e: Error) => {
  logger.error(`Error during "repeater": ${e.message}`);
  process.exit(1);
};

export class RunRepeater implements CommandModule {
  public readonly command = 'repeater [options]';
  public readonly describe = 'Starts an on-prem agent.';

  public builder(args: Argv): Argv {
    return args
      .option('bus', {
        default: 'amqps://amq.nexploit.app:5672',
        demandOption: true,
        describe: 'NexPloit Event Bus'
      })
      .option('token', {
        alias: 't',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('agent', {
        describe:
          'ID of an existing agent which you want to use to run a new scan.',
        type: 'string',
        requiresArg: true,
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
        describe:
          'JSON string which contains header list, which is initially empty and consists of zero or more name and value pairs.'
      })
      .env('REPEATER')
      .exitProcess(false);
  }

  public async handler(args: Arguments): Promise<void> {
    let bus: Bus;

    let headers: Record<string, string> = {};

    try {
      headers = (args.header as string[])?.length
        ? Helpers.parseHeaders(args.header as string[])
        : JSON.parse(args.headers as string);
    } catch {
      // noop
    }

    const stop: () => Promise<void> = async (): Promise<void> => {
      await bus.destroy();
      process.exit(0);
    };

    try {
      const requestExecutor = new DefaultRequestExecutor({
        headers,
        timeout: 10000,
        maxRedirects: 20,
        proxyUrl: args.proxy as string
      });
      const handlerRegistry = new DefaultHandlerRegistry(requestExecutor);

      bus = new RabbitMQBus(
        {
          onError,
          exchange: 'EventBus',
          clientQueue: `agent:${args.agent as string}`,
          connectTimeout: 10000,
          url: args.bus as string,
          proxyUrl: args.proxy as string,
          credentials: {
            username: args.agent as string,
            password: args.token as string
          }
        },
        handlerRegistry
      );

      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);

      await bus.init();

      await bus.subscribe(SendRequestHandler);
    } catch (e) {
      onError(e);
    }
  }
}

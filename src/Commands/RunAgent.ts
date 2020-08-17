import { AgentStatusUpdated, Bus, RabbitMQBus } from '../Bus';
import { DefaultHandlerRegistry, SendRequestHandler } from '../Handlers';
import { DefaultRequestExecutor } from '../RequestExecutor';
import { Helpers } from '../Utils/Helpers';
import { Arguments, Argv, CommandModule } from 'yargs';

export class RunAgent implements CommandModule {
  public readonly command = 'agent [options] <agent>';
  public readonly describe = 'Request to start a agent by its ID.';

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
      .option('api-key', {
        alias: 'K',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('header', {
        alias: 'H',
        requiresArg: true,
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .option('proxy', {
        describe: 'SOCKS4 or SOCKS5 url to proxy all traffic'
      })
      .positional('agent', {
        describe:
          'ID of an existing agent which you want to use to run a new scan.',
        type: 'string',
        demandOption: true
      })
      .exitProcess(false);
  }

  public async handler(args: Arguments): Promise<void> {
    let bus: Bus;
    try {
      const stop: () => Promise<void> = async (): Promise<void> => {
        await bus.publish(
          new AgentStatusUpdated(args.agent as string, 'disconnected')
        );
        await bus.destroy();
        process.exit(0);
      };
      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);
      const requestExecutor = new DefaultRequestExecutor({
        maxRedirects: 20,
        timeout: 5000,
        proxyUrl: args.proxy as string,
        headers: Helpers.parseHeaders(args.header as string[])
      });
      const handlerRegistry = new DefaultHandlerRegistry(requestExecutor);
      bus = new RabbitMQBus(
        {
          deadLetterQueue: 'dl',
          deadLetterExchange: 'DeadLetterExchange',
          exchange: 'EventBus',
          clientQueue: `agent:${args.agent as string}`,
          connectTimeout: 10000,
          url: args.bus as string,
          proxyUrl: args.proxy as string
        },
        handlerRegistry
      );

      await bus.init();

      await bus.subscribe(SendRequestHandler);

      await bus.publish(
        new AgentStatusUpdated(args.agent as string, 'connected')
      );
    } catch (e) {
      console.error(`Error during "agent": ${e.error || e.message}`);
      await bus.publish(
        new AgentStatusUpdated(args.agent as string, 'disconnected')
      );
      process.exit(1);
    }
  }
}

import { Bus, RabbitMQBus, RepeaterStatusUpdated } from '../Bus';
import { DefaultHandlerRegistry, SendRequestHandler } from '../Handlers';
import { DefaultRequestExecutor } from '../RequestExecutor';
import { Helpers } from '../Utils/Helpers';
import logger from '../Utils/Logger';
import { Arguments, Argv, CommandModule } from 'yargs';
import service from 'os-service';
import { promisify } from 'util';
import Timer = NodeJS.Timer;

export class RunRepeater implements CommandModule {
  private static serviceName = 'nexploit-daemon';
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
      .option('id', {
        alias: 'agent',
        describe:
          'ID of an existing repeater which you want to use to run a new scan.',
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
      .option('daemon', {
        requiresArg: false,
        alias: 'd',
        describe: 'Run as repeater in daemon mode'
      })
      .option('run', {
        requiresArg: false,
        hidden: true
      })
      .option('remove', {
        requiresArg: false,
        alias: 'rm',
        describe: 'Stop and remove repeater daemon'
      })
      .env('REPEATER')
      .exitProcess(false);
  }

  public async handler(args: Arguments): Promise<void> {
    let bus: Bus;
    let timer: Timer;
    let headers: Record<string, string> = {};

    try {
      headers = (args.header as string[])?.length
        ? Helpers.parseHeaders(args.header as string[])
        : JSON.parse(args.headers as string);
    } catch {
      // noop
    }

    const remove = async () => {
      try {
        await promisify(service.remove).call(this, RunRepeater.serviceName);
      } catch (e) {
        // noop if service does not exist
      }
    };

    if (args.remove) {
      await remove();
      process.exit(0);
    }

    if (args.daemon) {
      await remove();
      let runArgs = process.argv.slice(2);
      runArgs = runArgs.filter((x) => x !== '--daemon' && x !== '--d');
      service.add(
        RunRepeater.serviceName,
        {
          programArgs: runArgs.concat(['--run'])
        },
        (error: Error) => {
          if (error) {
            console.trace(error);
          }
        }
      );
      process.exit(0);
    }

    if (args.run) {
      service.run(() => {
        service.stop(0);
      });
    }
    const onError = (e: Error) => {
      clearInterval(timer);
      logger.error(`Error during "repeater": ${e.message}`);
      process.exit(1);
    };

    const stop: () => Promise<void> = async (): Promise<void> => {
      clearInterval(timer);
      await notify('disconnected');
      await bus.destroy();
      process.exit(0);
    };

    const notify = (status: 'connected' | 'disconnected') =>
      bus?.publish(new RepeaterStatusUpdated(args.id as string, status));

    try {
      const requestExecutor = new DefaultRequestExecutor({
        headers,
        timeout: 10000,
        proxyUrl: args.proxy as string
      });
      const handlerRegistry = new DefaultHandlerRegistry(requestExecutor);

      bus = new RabbitMQBus(
        {
          onError,
          exchange: 'EventBus',
          clientQueue: `agent:${args.id as string}`,
          connectTimeout: 10000,
          url: args.bus as string,
          proxyUrl: args.proxy as string,
          credentials: {
            username: args.id as string,
            password: args.token as string
          }
        },
        handlerRegistry
      );

      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);

      await bus.init();

      await bus.subscribe(SendRequestHandler);

      timer = setInterval(() => notify('connected'), 10000);

      await notify('connected');
    } catch (e) {
      await notify('disconnected');
      onError(e);
    }
  }
}

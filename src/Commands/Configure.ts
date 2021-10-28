import { logger } from '../Utils';
import { ConnectivityUrls, Platform, TestType, Options } from '../Wizard';
import { container } from '../Config';
import { Arguments, Argv, CommandModule } from 'yargs';
import { URL } from 'url';

export class Configure implements CommandModule {
  public readonly command = 'configure [options]';
  public readonly describe = 'Start a configuration wizard';

  private static getMapEntryOrThrow(
    type: TestType,
    input: string
  ): [TestType, URL] {
    try {
      return [type, new URL(input)];
    } catch (err) {
      throw new Error(`Invalid value for ${type} testing endpoint`);
    }
  }

  public builder(argv: Argv): Argv {
    return argv
      .option(TestType.TCP, {
        hidden: true,
        requiresArg: true,
        describe: `NeuraLegion Event Bus for connectivity test`
      })
      .option(TestType.HTTP, {
        hidden: true,
        requiresArg: true,
        describe: `NeuraLegion application for connectivity test`
      })
      .option(TestType.AUTH, {
        hidden: true,
        requiresArg: true,
        describe: `NeuraLegion event message authentication endpoint`
      })
      .option('nogui', {
        default: true,
        deprecated: true,
        boolean: true,
        describe: `Start a configuration wizard without GUI`
      })
      .option('ping', {
        boolean: true,
        describe: `Start network tests.`
      })
      .option('traceroute', {
        boolean: true,
        describe: `Start treceroute to a local recource.`
      })
      .option('max-ttl', {
        number: true,
        requiresArg: true,
        describe: `Set the max time-to-live (max number of hops) used in outgoing probe packets.`,
        default: 64
      })
      .option('probes', {
        alias: 'p',
        number: true,
        requiresArg: true,
        describe: `Set the number of probes per 'ttl'.`,
        default: 3
      })
      .group(['max-ttl', 'probes'], 'Traceroute Options')
      .conflicts('ping', 'traceroute')
      .middleware((args: Arguments) => {
        container
          .register<Options>(Options, {
            useValue: {
              traceroute: {
                maxTTL: !isNaN(+args.maxTtl) ? +args.maxTtl : undefined,
                probes: !isNaN(+args.probes) ? +args.probes : undefined
              }
            }
          })
          .register(ConnectivityUrls, {
            useValue: new Map([
              Configure.getMapEntryOrThrow(
                TestType.TCP,
                (args[TestType.TCP] ?? args.bus) as string
              ),
              Configure.getMapEntryOrThrow(
                TestType.HTTP,
                (args[TestType.HTTP] ?? args.api) as string
              ),
              Configure.getMapEntryOrThrow(
                TestType.AUTH,
                (args[TestType.AUTH] ??
                  `${args.api}/api/v1/repeaters/user`) as string
              )
            ])
          });
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const app = container.resolve<Platform>(Platform);

      const stop: () => void = () => {
        app.stop();
        process.exit(0);
      };

      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);
      await app.start({ ping: !!args.ping, traceroute: !!args.traceroute });
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

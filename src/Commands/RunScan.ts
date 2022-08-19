import {
  AttackParamLocation,
  COMPREHENSIVE_SCAN_TESTS,
  IntegrationType,
  Module,
  RequestExclusion,
  RestScansOptions,
  ScanConfig,
  Scans,
  TestType
} from '../Scan';
import { Helpers, logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class RunScan implements CommandModule {
  public readonly command = 'scan:run [options]';
  public readonly describe = 'Start a new scan for the received configuration.';

  private static splitCompositeStringBySeparator(
    val: string,
    separator: string = ':'
  ): string[] {
    return val
      .split(new RegExp(`${separator}(.+)`), 2)
      .map((part: string) => part.toLowerCase().trim());
  }

  private static verifyIntegration(
    integration: IntegrationType,
    board: string
  ): void {
    if (
      !Object.values(IntegrationType).includes(integration as IntegrationType)
    ) {
      throw new Error(
        `Selected type of integration is not supported: ${integration}.`
      );
    }

    if (!board.length) {
      throw new Error(
        `You have to specify a board name after separator. For example: "github:NeuraLegion/nexploit-cli".`
      );
    }
  }

  private static mapIntegrationsToRegistry(
    integrations: string[]
  ): Map<IntegrationType, string[]> {
    return integrations
      .map((x: string) => this.splitCompositeStringBySeparator(x))
      .reduce(
        (
          registry: Map<IntegrationType, string[]>,
          [integration, board]: string[]
        ) => {
          const integrationBoards =
            registry.get(integration as IntegrationType) ?? [];

          integrationBoards.push(board);

          registry.set(integration as IntegrationType, [
            ...new Set(integrationBoards)
          ]);

          return registry;
        },
        new Map<IntegrationType, string[]>()
      );
  }

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('name', {
        alias: 'n',
        describe: 'Name of the scan.',
        requiresArg: true,
        demandOption: true
      })
      .option('auth', {
        alias: 'o',
        describe: 'Auth object ID.',
        requiresArg: true
      })
      .option('repeater', {
        alias: 'agent',
        requiresArg: true,
        array: true,
        describe: 'ID of any repeaters connected with the scan.'
      })
      .option('archive', {
        alias: 'a',
        normalize: true,
        requiresArg: true,
        describe:
          "A collection your app's http/websockets logs into HAR file. " +
          'Usually you can use browser dev tools or our browser web extension'
      })
      .option('crawler', {
        alias: 'c',
        requiresArg: true,
        array: true,
        describe:
          'A list of specific urls that should be included into crawler.'
      })
      .option('test', {
        choices: Helpers.toArray(TestType),
        default: COMPREHENSIVE_SCAN_TESTS,
        array: true,
        describe: 'A list of tests which you want to run during a scan.'
      })
      .option('integration', {
        alias: 'i',
        array: true,
        requiresArg: true,
        describe:
          'The integration name your project uses. Name must contain an integration name and a name of board, ' +
          'represented as "INTEGRATION_NAME:BOARD_NAME". A name component may not start or end with a separator. ' +
          'Example: "github:NeuraLegion/nexploit-cli"'
      })
      .option('project', {
        alias: 'p',
        requiresArg: true,
        string: true,
        describe: 'ID of the project'
      })
      .option('module', {
        default: Module.DAST,
        requiresArg: true,
        choices: Helpers.toArray(Module),
        describe:
          'The dast module tests for specific scenarios, mainly OWASP top 10 and other common scenarios. ' +
          'The fuzzer module generates various scenarios to test for unknown vulnerabilities, ' +
          'providing automated AI led fuzzing testing. This module can be coupled with the repeater to find additional vulnerabilities.'
      })
      .option('host-filter', {
        alias: 'F',
        requiresArg: true,
        array: true,
        describe: 'A list of specific hosts that should be included into scan.'
      })
      .option('header', {
        alias: 'H',
        requiresArg: true,
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .option('exclude-param', {
        requiresArg: true,
        array: true,
        string: true,
        describe:
          'A list of regex patterns for parameter names you would like to ignore during the tests. Example: "Id$"'
      })
      .option('exclude-entry-point', {
        array: true,
        describe:
          'A list of JSON strings that contain patterns for entry points you would like to ignore during the tests. ' +
          'Pass an empty string to remove default exclusions. ' +
          'To apply patterns for all HTTP methods, you can set an empty array to "methods". ' +
          'Example: "{ "methods": [], "patterns": "users\\/?$" }"',
        coerce(args: string[]): RequestExclusion[] {
          return args
            .map((arg: string) => JSON.parse(arg))
            .map(
              ({ methods = [], patterns = [] }: Partial<RequestExclusion>) => {
                if (!patterns.length) {
                  logger.error(
                    'Error during "scan:run": please make sure that patterns contain at least one regexp.'
                  );
                  process.exit(1);
                }

                return {
                  methods: [...new Set(methods)],
                  patterns: [...new Set(patterns)]
                };
              }
            );
        }
      })
      .option('smart', {
        boolean: true,
        describe:
          'Use automatic smart decisions such as: parameter skipping, detection phases, etc. to minimize scan time.'
      })
      .option('param', {
        array: true,
        default: [
          AttackParamLocation.BODY,
          AttackParamLocation.QUERY,
          AttackParamLocation.FRAGMENT
        ],
        requiresArg: true,
        choices: Helpers.toArray(AttackParamLocation),
        describe: 'Defines which part of the request to attack.'
      })
      .group(['archive', 'crawler'], 'Discovery Options')
      .group(
        ['host-filter', 'header', 'module', 'repeater', 'test', 'smart'],
        'Additional Options'
      )
      .check((args: Arguments) => {
        const integrations = (args.integration ?? []) as string[];

        if (integrations?.length && !args.project) {
          throw new Error('Argument integration requires project to be set.');
        }

        integrations.forEach((val: string) => {
          const [integration, board]: string[] =
            RunScan.splitCompositeStringBySeparator(val);
          RunScan.verifyIntegration(integration as IntegrationType, board);
        });

        return true;
      })
      .middleware((args: Arguments) => {
        const integrations = args.integration as string[];

        args.boards = integrations
          ? RunScan.mapIntegrationsToRegistry(integrations)
          : undefined;
      })
      .middleware((args: Arguments) =>
        container.register<RestScansOptions>(RestScansOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseUrl: args.api as string,
            apiKey: args.token as string,
            proxyUrl: (args.proxyExternal ?? args.proxy) as string
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager: Scans = container.resolve(Scans);

      const scanId: string = await scanManager.create({
        name: args.name,
        module: args.module,
        authObjectId: args.auth,
        projectId: args.project,
        tests: args.test,
        hostsFilter: args.hostFilter,
        headers: Helpers.parseHeaders(args.header as string[]),
        crawlerUrls: args.crawler,
        fileId: args.archive,
        repeaters: args.repeater,
        smart: args.smart,
        attackParamLocations: args.param,
        boards: args.boards,
        exclusions: {
          requests: args.excludeEntryPoint,
          params: args.excludeParam
        }
      } as ScanConfig);

      // eslint-disable-next-line no-console
      console.log(scanId);

      process.exit(0);
    } catch (e) {
      logger.error(`Error during "scan:run": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

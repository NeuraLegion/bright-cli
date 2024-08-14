import {
  AttackParamLocation,
  Module,
  RequestExclusion,
  RestScansOptions,
  ScanConfig,
  Scans,
  ATTACK_PARAM_LOCATIONS_DEFAULT
} from '../Scan';
import { Helpers, logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';
import { isAxiosError } from 'axios';
import { EOL } from 'node:os';

export class RunScan implements CommandModule {
  public readonly command = 'scan:run [options]';
  public readonly describe = 'Start a new scan for the received configuration.';

  public static excludeEntryPoint(args: string[]): RequestExclusion[] {
    return args
      .map((arg: string) => JSON.parse(arg))
      .map(({ methods = [], patterns = [] }: Partial<RequestExclusion>) => {
        const nonEmptyPatterns = patterns.filter((pattern) => !!pattern);

        if (!nonEmptyPatterns.length) {
          logger.error(
            'Error during "scan:run": please make sure that patterns contain at least one regexp.'
          );
          process.exit(1);
        }

        return {
          methods: [...new Set(methods)],
          patterns: [...new Set(nonEmptyPatterns)]
        };
      });
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
        array: true,
        describe:
          'A list of tests to run during a scan. ' +
          `If no tests are specified, the default tests will be run.${EOL}` +
          `For more information on the default tests, refer to the documentation: https://docs.brightsec.com/docs/running-a-scan${EOL}` +
          'Additional details about available tests can be found here: ' +
          'https://docs.brightsec.com/docs/vulnerability-guide'
      })
      .option('bucket', {
        array: true,
        describe: 'A list of test buckets which you want to run during a scan.'
      })
      .option('project', {
        alias: 'p',
        requiresArg: true,
        string: true,
        describe: 'ID of the project'
      })
      .option('template', {
        alias: 'tp',
        requiresArg: false,
        string: true,
        describe: 'Scan template ID'
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
          `Example: '{ "methods": [], "patterns": ["users\\/?$"] }'`,
        coerce: RunScan.excludeEntryPoint
      })
      .option('smart', {
        boolean: true,
        describe:
          'Use automatic smart decisions such as: parameter skipping, detection phases, etc. to minimize scan time.'
      })
      .option('param', {
        array: true,
        defaultDescription: `[${ATTACK_PARAM_LOCATIONS_DEFAULT.map(
          (item) => `"${item}"`
        ).join(',')}]`,
        requiresArg: true,
        choices: Helpers.toArray(AttackParamLocation),
        describe: 'Defines which part of the request to attack.'
      })
      .option('entrypoint', {
        array: true,
        alias: 'e',
        describe:
          'List entrypoint IDs to scan specific entrypoints. If no IDs are provided, the scan will run on the first 2000 project-level entrypoints. This option requires to specify the project ID using the --project option.'
      })
      .group(['archive', 'crawler'], 'Discovery Options')
      .group(
        ['host-filter', 'header', 'module', 'repeater', 'test', 'smart'],
        'Additional Options'
      )
      .middleware((args: Arguments) =>
        container.register<RestScansOptions>(RestScansOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseURL: args.api as string,
            apiKey: args.token as string,
            proxyURL: (args.proxyBright ?? args.proxy) as string
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager: Scans = container.resolve(Scans);

      const { id: scanId, warnings = [] } = await scanManager.create({
        tests: args.test,
        name: args.name,
        module: args.module,
        authObjectId: args.auth,
        projectId: args.project,
        templateId: args.template,
        buckets: args.bucket,
        hostsFilter: args.hostFilter,
        headers: Helpers.parseHeaders(args.header as string[]),
        crawlerUrls: args.crawler,
        fileId: args.archive,
        repeaters: args.repeater,
        smart: args.smart,
        attackParamLocations: args.param,
        exclusions: {
          requests: args.excludeEntryPoint,
          params: args.excludeParam
        },
        entryPointIds: args.entrypoint
      } as ScanConfig);

      // eslint-disable-next-line no-console
      console.log(scanId);

      if (warnings.length) {
        logger.warn(
          `${warnings.map((warning) => warning.message).join('\n')}\n`
        );
      }

      process.exit(0);
    } catch (e) {
      const errMessage =
        isAxiosError(e) && typeof e.response?.data === 'string'
          ? e.response.data
          : e.error || e.message;
      logger.error(`Error during "scan:run": ${errMessage}`);
      process.exit(1);
    }
  }
}

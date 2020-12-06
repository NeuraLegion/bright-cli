import { RestScans, Module, ScanConfig, TestType } from '../Scan';
import { Helpers } from '../Utils/Helpers';
import logger from '../Utils/Logger';
import { AttackParamLocation, COMPREHENSIVE_SCAN_TESTS } from '../Scan/Scans';
import { Arguments, Argv, CommandModule } from 'yargs';

export class RunScan implements CommandModule {
  public readonly command = 'scan:run [options]';
  public readonly describe = 'Start a new scan for the received configuration.';

  public builder(args: Argv): Argv {
    return args
      .option('token', {
        alias: 't',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('name', {
        alias: 'n',
        describe: 'Name of the scan.',
        requiresArg: true,
        demandOption: true
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
      .option('service', {
        choices: ['jenkins', 'circleci', 'travisci'],
        requiresArg: true,
        describe: 'The CI tool name your project uses.'
      })
      .option('build-number', {
        number: true,
        requiresArg: true,
        describe: 'The current build number.',
        implies: ['service']
      })
      .option('project', {
        requiresArg: true,
        describe:
          'Name of the project of this build. This is the name you gave your job or workflow when you first setup CI.',
        implies: ['service']
      })
      .option('user', {
        requiresArg: true,
        describe: 'Name of the user that is currently signed in.',
        implies: ['service']
      })
      .option('vcs', {
        requiresArg: true,
        choices: ['github', 'bitbucket'],
        implies: ['service'],
        describe:
          'The version control system type your project uses. Current choices are github or bitbucket. CircleCI only.'
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
        ['service', 'build-number', 'vcs', 'project', 'user'],
        'Build Options'
      )
      .group(
        ['host-filter', 'header', 'module', 'repeater', 'test', 'smart'],
        'Additional Options'
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager = new RestScans({
        baseUrl: args.api as string,
        apiKey: args.token as string,
        proxyUrl: args.proxy as string
      });

      const scanId: string = await scanManager.create({
        name: args.name,
        module: args.module,
        tests: args.test,
        hostsFilter: args.hostFilter,
        headers: Helpers.parseHeaders(args.header as string[]),
        crawlerUrls: args.crawler,
        fileId: args.archive,
        repeaters: args.repeater,
        smart: args.smart,
        attackParamLocations: args.param,
        build: args.service
          ? {
              service: args.service,
              buildNumber: args.buildNumber,
              project: args.project,
              user: args.user,
              vcs: args.vcs
            }
          : undefined
      } as ScanConfig);

      logger.log(scanId);

      process.exit(0);
    } catch (e) {
      logger.error(`Error during "scan:run": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

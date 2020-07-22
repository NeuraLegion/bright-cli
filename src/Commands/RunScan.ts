import { InlineHeaders } from '../Parsers';
import {
  FailureError,
  Module,
  RunStrategyConfig,
  ServicesApiFactory,
  TestType,
  toArray
} from '../Strategy';
import { Arguments, Argv, CommandModule } from 'yargs';

export class RunScan implements CommandModule {
  public readonly command = 'scan:run';
  public readonly describe = 'Start a new scan for the received configuration.';

  public builder(args: Argv): Argv {
    return args
      .option('api', {
        default: 'https://nexploit.app/',
        hidden: true,
        describe: 'NexPloit base url'
      })
      .option('api-key', {
        alias: 'K',
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
      .option('agent', {
        requiresArg: true,
        array: true,
        describe: 'ID of any agents connected with the scan.'
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
        choices: toArray(TestType),
        default: toArray(TestType),
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
        choices: toArray(Module),
        describe:
          'The dast module tests for specific scenarios, mainly OWASP top 10 and other common scenarios. ' +
          'The fuzzer module generates various scenarios to test for unknown vulnerabilities, ' +
          'providing automated AI led fuzzing testing. This module can be coupled with the agent to find additional vulnerabilities.'
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
      .group(['archive', 'crawler'], 'Discovery Options')
      .group(
        ['service', 'build-number', 'vcs', 'project', 'user'],
        'Build Options'
      )
      .group(
        ['host-filter', 'header', 'module', 'agent', 'test'],
        'Additional Options'
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const headerParser = new InlineHeaders();
      const scanId: string = await new ServicesApiFactory(
        args.api as string,
        args.apiKey as string
      )
        .createScanManager()
        .create({
          name: args.name,
          module: args.module,
          tests: args.test,
          hostsFilter: args.hostFilter,
          headers: headerParser.parse(args.header as string[]),
          crawlerUrls: args.crawler,
          fileId: args.archive,
          agents: args.agent,
          build: args.service
            ? {
                service: args.service,
                buildNumber: args.buildNumber,
                project: args.project,
                user: args.user,
                vcs: args.vcs
              }
            : undefined
        } as RunStrategyConfig);

      console.log(scanId);

      process.exit(0);
    } catch (e) {
      if (e instanceof FailureError) {
        console.error(`Scan failure during "scan:run": ${e.message}`);
        process.exit(50);

        return;
      }

      console.error(`Error during "scan:run" run: ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

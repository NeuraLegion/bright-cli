import * as yargs from 'yargs';
import { RunStrategyFactory } from '../Strategy/Run/RunStrategyFactory';
import { InlineHeaders } from '../Parsers/InlineHeaders';
import {
  Discovery,
  RunStrategyExecutor
} from '../Strategy/Run/RunStrategyExecutor';
import { FailureStrategyFactory } from '../Strategy/Failure/FailureStrategyFactory';
import { FailureOnType, Polling } from '../Strategy/Failure/Polling';
import { ExecutorFactory } from '../Strategy/ExecutorFactory';
import { FailureError } from '../Strategy/Failure/FailureError';

export class RunScan implements yargs.CommandModule {
  public readonly command = 'scan:run';
  public readonly describe = 'Start a new scan for the received configuration.';

  public builder(args: yargs.Argv): yargs.Argv {
    return args
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
      .option('archive', {
        alias: 'f',
        normalize: true,
        requiresArg: true,
        conflicts: ['oas'],
        describe:
          "A collection your app's http/websockets logs into HAR or WSAR file. " +
          'Usually you can use browser dev tools or our browser web extension'
      })
      .option('crawler', {
        alias: 'c',
        requiresArg: true,
        array: true,
        conflicts: ['oas'],
        describe:
          'A list of specific urls that should be included into crawler.'
      })
      .option('oas', {
        alias: 'o',
        requiresArg: true,
        normalize: true,
        conflicts: ['archive', 'crawler'],
        describe: 'A file of your OAS specification.'
      })
      .option('protocol', {
        alias: 'p',
        requiresArg: true,
        choices: ['http', 'websocket'],
        describe: 'Exploited protocol: HTTP, Websocket, etc.',
        demandOption: true
      })
      .option('type', {
        alias: 'T',
        default: 'appscan',
        requiresArg: true,
        choices: ['appscan', 'protoscan'],
        describe: 'Protocol-type scan or Application-type scan.',
        demandOption: true
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
        default: 'core',
        requiresArg: true,
        choices: ['core', 'exploratory'],
        describe:
          'The core module tests for specific scenarios, mainly OWASP top 10 and other common scenarios. ' +
          'The exploratory module generates various scenarios to test for unknown vulnerabilities, ' +
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
      .option('discard', {
        alias: 'd',
        default: true,
        boolean: true,
        describe:
          'Indicates if archive should be remove or not after scan running. Enabled by default.'
      })
      .option('api', {
        default: 'https://nexploit.app/api/v1/',
        hidden: true,
        describe: 'NexPloit base url'
      })
      .option('polling', {
        boolean: true,
        default: false,
        describe: "Enables the API polling to check a scan's status.",
        implies: ['interval', 'failure-on']
      })
      .option('interval', {
        number: true,
        default: 5000,
        implies: ['polling', 'failure-on']
      })
      .option('failure-on', {
        choices: [
          'first-issue',
          'first-medium-severity-issue',
          'first-high-severity-issue',
          'none'
        ],
        string: true,
        default: ['none'],
        implies: ['polling', 'interval']
      })
      .group(['polling', 'interval', 'failure-on'], 'polling')
      .group(['archive', 'crawler', 'oas', 'discard'], 'Discovery Options')
      .group(
        ['service', 'build-number', 'vcs', 'project', 'user'],
        'Build Options'
      )
      .group(['host-filter', 'header', 'api', 'module'], 'Additional Options');
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      const executorFactory: ExecutorFactory = new ExecutorFactory(
        args.api as string,
        args['api-key'] as string
      );
      const runStrategyExecutor: RunStrategyExecutor = executorFactory.CreateRunExecutor(
        {
          protocol: args.protocol,
          type: args.type,
          name: args.name,
          module: args.module,
          hostsFilter: args['host-filter'],
          headers: new InlineHeaders(args.header as string[]).get(),
          crawlerUrls: args['crawler'],
          filePath: args.archive || args.oas,
          fileDiscard: args.discard,
          build: args.service
            ? {
                service: args.service,
                buildNumber: args.buildNumber,
                project: args.project,
                user: args.user,
                vcs: args.vcs
              }
            : undefined
        } as any
      );

      const discoveryTypes: Discovery[] = Object.keys(args).filter(
        (key: string) => Object.values(Discovery).includes(key)
      ) as Discovery[];

      const scanId: string = await runStrategyExecutor.execute(
        RunStrategyFactory.Instance.Create(discoveryTypes)
      );

      if (args.polling) {
        const polling: Polling = executorFactory.CreatePolling({
          scanId,
          poolingInterval: args.interval as number
        });

        await polling.check(
          FailureStrategyFactory.Instance.Create(args[
            'failure-on'
          ] as FailureOnType)
        );
      }

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

import * as yargs from 'yargs';
import { RunStrategyFactory } from '../Strategy/RunStrategyFactory';
import { InlineHeaders } from '../Parsers/InlineHeaders';

export class RunScan implements yargs.CommandModule {
  public readonly command = 'scan:run';
  public readonly describe = 'Start a new scan for the received configuration.';

  public builder(args: yargs.Argv): yargs.Argv {
    return args
      .option('api-key', {
        alias: 'K',
        describe: 'NexPloit API-key',
        demandOption: true
      })
      .option('name', {
        alias: 'n',
        describe: 'Name of the scan.',
        demandOption: true
      })
      .option('header', {
        alias: 'H',
        default: [],
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .option('discovery', {
        alias: 'D',
        choices: ['archive', 'crawler'],
        array: true,
        describe: 'Archive-type scan or Crawler-type scan.',
        default: ['archive']
      })
      .option('archive', {
        alias: 'f',
        normalize: true,
        describe:
          "A collection your app's http/websockets logs into HAR or WSAR file. " +
          'Usually you can use browser dev tools or our browser web extension'
      })
      .option('host-filter', {
        alias: 'F',
        default: [],
        array: true,
        describe: 'A list of specific hosts that should be included into scan.'
      })
      .option('crawler-url', {
        alias: 'C',
        default: [],
        array: true,
        describe:
          'A list of specific urls that should be included into crawler.'
      })
      .option('protocol', {
        alias: 'p',
        choices: ['http', 'websocket'],
        describe: 'Exploited protocol: HTTP, Websocket, etc.',
        demandOption: true
      })
      .option('type', {
        alias: 'T',
        default: 'appscan',
        choices: ['appscan', 'protoscan'],
        describe: 'Protocol-type scan or Application-type scan.',
        demandOption: true
      })
      .option('module', {
        default: 'core',
        choices: ['core', 'exploratory'],
        describe:
          'The core module tests for specific scenarios, mainly OWASP top 10 and other common scenarios. ' +
          'The exploratory module generates various scenarios to test for unknown vulnerabilities, ' +
          'providing automated AI led fuzzing testing. This module can be coupled with the agent to find additional vulnerabilities.'
      })
      .option('service', {
        choices: ['jenkins', 'circleci', 'travisci'],
        describe: 'The CI tool name your project uses.',
        implies: ['build-number', 'project', 'vcs', 'user']
      })
      .option('build-number', {
        number: true,
        describe: 'The current build number.'
      })
      .option('project', {
        describe:
          'Name of the project of this build. This is the name you gave your job or workflow when you first setup CI.'
      })
      .option('user', {
        describe: 'Name of the user that is currently signed in.'
      })
      .option('vcs', {
        choices: ['github', 'bitbucket'],
        describe:
          'The version control system type your project uses. Current choices are github or bitbucket. CircleCI only.'
      })
      .group(['service', 'build-number', 'vcs', 'project', 'user'], 'build')
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
      });
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      await new RunStrategyFactory()
        .Create(
          args.discovery as ('crawler' | 'archive' | 'oas')[],
          args.api as string,
          args['api-key'] as string
        )
        .run({
          protocol: args.protocol,
          type: args.type,
          name: args.name,
          discoveryTypes: args.discovery,
          module: args.module,
          hostsFilter: args['host-filter'],
          headers: new InlineHeaders(args.header as string[]).get(),
          crawlerUrls:
            (args['crawler-url'] as any).length === 0
              ? null
              : args['crawler-url'],
          filePath: args.archive,
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
        } as any);

      process.exit(0);
    } catch (e) {
      console.error(`Error during "scan:run" run: ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

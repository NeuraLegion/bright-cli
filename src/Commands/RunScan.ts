import * as yargs from 'yargs';
import { InlineHeaders } from '../Parsers/InlineHeaders';
import { FailureError } from '../Strategy/Failure/FailureError';
import { ServicesApiFactory } from '../Strategy/ServicesApiFactory';

export class RunScan implements yargs.CommandModule {
  public readonly command = 'scan:run';
  public readonly describe = 'Start a new scan for the received configuration.';

  public builder(args: yargs.Argv): yargs.Argv {
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
      .option('archive', {
        alias: 'a',
        normalize: true,
        requiresArg: true,
        describe:
          "A collection your app's http/websockets logs into HAR or WSAR file. " +
          'Usually you can use browser dev tools or our browser web extension'
      })
      .option('crawler', {
        alias: 'c',
        requiresArg: true,
        array: true,
        describe:
          'A list of specific urls that should be included into crawler.'
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
        default: 'dast',
        requiresArg: true,
        choices: ['dast', 'fuzzer'],
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
      .group(['host-filter', 'header', 'module'], 'Additional Options');
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      const scanId: string = await new ServicesApiFactory(
        args.api as string,
        args.apiKey as string
      )
        .CreateScanManager()
        .create({
          protocol: args.protocol,
          type: args.type,
          name: args.name,
          moduleRef: args.module,
          hostsFilter: args.hostFilter,
          headers: new InlineHeaders().parse(args.header as string[]),
          crawlerUrls: args.crawler,
          fileId: args.archive,
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

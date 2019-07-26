import {createReadStream} from 'fs';
import * as request from 'request-promise';
import {RequestPromiseAPI} from 'request-promise';
import * as yargs from 'yargs';
import {FileExistingValidator} from '../Utils/FileExistingValidator';
import {basename} from 'path';

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
      .option('archive', {
        alias: 'f',
        normalize: true,
        describe: 'A collection your app\'s http/websockets logs into HAR or WSAR file. ' +
          'Usually you can use browser dev tools or our browser web extension',
        demandOption: true
      })
      .option('host-filter', {
        alias: 'F',
        default: [],
        array: true,
        describe: 'A list of specific hosts that should be included into scan.'
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
        describe: 'The core module tests for specific scenarios, mainly OWASP top 10 and other common scenarios. ' +
          'The exploratory module generates various scenarios to test for unknown vulnerabilities, ' +
          'providing automated AI led fuzzing testing. This module can be coupled with the agent to find additional vulnerabilities.'
      })
      .option('service', {
        choices: ['jenkins', 'circleci', 'travisci'],
        describe: 'The CI tool name your project uses.',
        implies: ['build-number', 'project', 'vcs']
      })
      .option('build-number', {
        number: true,
        describe: 'The current build number.'
      })
      .option('project', {
        describe: 'Name of the project of this build. This is the name you gave your job or workflow when you first setup CI.'
      })
      .option('vcs', {
        choices: ['github', 'bitbucket'],
        describe: 'The version control system type your project uses. Current choices are github or bitbucket. CircleCI only.'
      })
      .group(['service', 'build-number', 'vcs', 'project'], 'build')
      .option('discard', {
        alias: 'd',
        default: true,
        boolean: true,
        describe: 'Indicates if archive should be remove or not after scan running. Enabled by default.'
      })
      .option('api', {
        default: 'https://nexploit.app/api/v1/',
        hidden: true,
        describe: 'NexPloit base url'
      });
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      const proxy: RequestPromiseAPI = request.defaults({
        baseUrl: args.api as string,
        headers: {Authorization: `Api-Key ${args['api-key']}`}
      });

      await new FileExistingValidator()
        .validate(args.archive as string);

      const {ids}: { ids: string[] } = await proxy.post({
        uri: `/files`,
        qs: {discard: args.discard},
        json: true,
        formData: {
          har: createReadStream(args.archive as string)
        }
      });

      console.log(`${basename(args.archive as string)} was uploaded by ${args.$0}.`);

      await proxy.post({
        uri: `/scans`,
        json: true,
        body: {
          protocol: args.protocol,
          type: args.type,
          name: args.name,
          discoveryTypes: ['archive'],
          module: args.module,
          hostsFilter: args['host-filter'],
          fileId: ids[0],
          build: args.service ?
            {
              service: args.service,
              buildNumber: args.buildNumber,
              project: args.project,
              vcs: args.vcs
            } :
            undefined
        }
      });

      console.log(`${args.name} scan was ran by ${args.$0}.`);
      process.exit(0);
    } catch (e) {
      console.error(`Error during "scan:run" run: ${e.error || e.message}`);
      process.exit(1);
    }
  }

}

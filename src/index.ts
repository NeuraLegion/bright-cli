import 'reflect-metadata';
import {
  GenerateArchive,
  PollingScanStatus,
  RetestScan,
  RunRepeater,
  RunScan,
  StopScan,
  UploadArchive,
  VersionCommand
} from './Commands';
import { CliBuilder, DefaultConfigReader } from './Config';

const cli: CliBuilder = new CliBuilder({
  colors: true,
  cwd: process.cwd()
});

cli
  .build({
    configReader: new DefaultConfigReader(),
    commands: [
      new RunRepeater(),
      new VersionCommand(),
      new GenerateArchive(),
      new PollingScanStatus(),
      new RunScan(),
      new RetestScan(),
      new StopScan(),
      new UploadArchive()
    ]
  })
  .wrap(null).argv;

import 'reflect-metadata';
import {
  GenerateArchive,
  PollingScanStatus,
  RetestScan,
  RunScan,
  StopScan,
  UploadArchive,
  VersionCommand
} from './Commands';
import { CliBuilder } from './Config/CliBuilder';

const cli: CliBuilder = new CliBuilder({
  colors: true,
  cwd: process.cwd()
});

// tslint:disable:no-unused-expression
cli.build(
  new VersionCommand(),
  new GenerateArchive(),
  new PollingScanStatus(),
  new RunScan(),
  new RetestScan(),
  new StopScan(),
  new UploadArchive()
).argv;

import {
  GenerateArchive,
  PollingScanStatus,
  RetestScan,
  RunScan,
  StopScan,
  UploadArchive,
  VersionCommand
} from './Commands';
import { CliBuilder } from './Config';

const cli: CliBuilder = new CliBuilder({
  colors: true,
  cwd: process.cwd()
});

cli
  .build(
    new VersionCommand(),
    new GenerateArchive(),
    new PollingScanStatus(),
    new RunScan(),
    new RetestScan(),
    new StopScan(),
    new UploadArchive()
  )
  .wrap(null).argv;

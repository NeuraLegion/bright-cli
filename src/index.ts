process.env.UV_THREADPOOL_SIZE = String(1024);
import 'reflect-metadata';
import {
  GenerateArchive,
  PollingScanStatus,
  RetestScan,
  RunRepeater,
  RunScan,
  StopScan,
  UploadArchive,
  VersionCommand,
  Configure,
  Integration
} from './Commands';
import { CliBuilder, container } from './Config';

container.resolve(CliBuilder).build({
  commands: [
    new RunRepeater(),
    new VersionCommand(),
    new GenerateArchive(),
    new PollingScanStatus(),
    new RunScan(),
    new RetestScan(),
    new StopScan(),
    new UploadArchive(),
    new Configure(),
    new Integration()
  ]
}).argv;

process.env.UV_THREADPOOL_SIZE = String(1024);
process.env.NODE_OPTIONS = `${
  process.env.NODE_OPTIONS ?? ''
} --max-http-header-size=40960`.trim();
import 'reflect-metadata';
import {
  PollingScanStatus,
  RetestScan,
  RunRepeater,
  RunScan,
  StopScan,
  UploadArchive,
  VersionCommand,
  Configure
} from './Commands';
import { CliBuilder, container } from './Config';

container.resolve(CliBuilder).build({
  commands: [
    new RunRepeater(),
    new VersionCommand(),
    new PollingScanStatus(),
    new RunScan(),
    new RetestScan(),
    new StopScan(),
    new UploadArchive(),
    new Configure()
  ]
}).argv;

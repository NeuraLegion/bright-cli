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
  Configure,
  GetEntryPoints
} from './Commands';
import { CliBuilder } from './Config';
import container from './container';
import { RunDiscovery } from './Commands/RunDiscovery';
import { StopDiscovery } from './Commands/StopDiscovery';
import { RerunDiscovery } from './Commands/RerunDiscovery';
import { PollingDiscoveryStatus } from './Commands/PollingDiscoveryStatus';
import { PollingHostUpdateJobStatus } from './Commands/PollingHostUpdateJobStatus';
import { EntryPointsUpdateHost } from './Commands/EntryPointsUpdateHost';

container.resolve(CliBuilder).build({
  commands: [
    new RunRepeater(),
    new VersionCommand(),
    new PollingScanStatus(),
    new RunScan(),
    new RetestScan(),
    new StopScan(),
    new RunDiscovery(),
    new StopDiscovery(),
    new RerunDiscovery(),
    new PollingDiscoveryStatus(),
    new PollingHostUpdateJobStatus(),
    new UploadArchive(),
    new Configure(),
    new GetEntryPoints(),
    new EntryPointsUpdateHost()
  ]
}).argv;

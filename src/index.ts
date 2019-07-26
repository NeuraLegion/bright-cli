import 'reflect-metadata';
import {GenerateArchive, RunScan, VersionCommand} from './Commands';
import {CliBuilder} from './Config/CliBuilder';

const cli: CliBuilder = new CliBuilder({
  colors: true,
  cwd: process.cwd()
});

cli
  .build(
    new VersionCommand(),
    new GenerateArchive(),
    new RunScan()
  )
  .argv;

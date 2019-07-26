import 'reflect-metadata';
import {GenerateArchive, RunScan, VersionCommand} from './Commands';
import {CliBuilder} from './Config/CliBuilder';

const cli: CliBuilder = new CliBuilder({
  colors: true,
  cwd: process.cwd()
});

// tslint:disable:no-unused-expression
cli
  .build(
    new VersionCommand(),
    new GenerateArchive(),
    new RunScan()
  )
  .argv;

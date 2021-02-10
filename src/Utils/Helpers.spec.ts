import { Helpers } from './Helpers';
import { should } from 'chai';

should();

describe('Helpers', () => {
  describe('getExecArgs', () => {
    it('should return current exec args', () => {
      const { args, command } = Helpers.getExecArgs();
      command.should.eq(process.execPath);
      args.should.have.members([...process.execArgv, ...process.argv.slice(1)]);
    });

    it('should return exec args excluding all app args', () => {
      const { args, command } = Helpers.getExecArgs({ excludeAll: true });
      command.should.eq(process.execPath);
      args.should.have.members([process.argv[1]]);
    });

    it('should return exec args including extra args', () => {
      const extraArgs = ['--run'];
      const { args, command } = Helpers.getExecArgs({ include: extraArgs });
      command.should.eq(process.execPath);
      args.should.have.members([
        ...process.execArgv,
        ...process.argv.slice(1),
        ...extraArgs
      ]);
    });

    it('should return exec args excluding specific args', () => {
      const excessArgs = [...process.argv].slice(-2);
      const { args, command } = Helpers.getExecArgs({ exclude: excessArgs });
      command.should.eq(process.execPath);
      args.should.have.members([
        ...process.execArgv,
        ...process.argv.slice(1, process.argv.length - 2)
      ]);
    });
  });
});

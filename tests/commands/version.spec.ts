import { Cli } from '../setup';
import { resolve } from 'path';

describe('"version" command', () => {
  let cli: Cli | undefined;

  beforeEach(() => {
    cli = new Cli(process.execPath, [
      '-r',
      'ts-node/register/transpile-only',
      '-r',
      'tsconfig-paths/register',
      resolve(process.cwd(), 'src/index.ts')
    ]);
  });

  it('should not find any installed version', async () => {
    const actual = await cli.spawn('version');
    expect(actual).toEqual(
      expect.stringContaining('No local installed NexPloit CLI was found.')
    );
    expect(actual).toEqual(
      expect.stringContaining('No global installed was found.')
    );
  });
});

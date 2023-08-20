import { Cli } from '../Setup';
import { resolve } from 'path';

describe('Version Command', () => {
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

  it(
    'should not find any installed version',
    async () => {
      const actual = await cli.exec('version');
      expect(actual).toEqual(
        expect.stringContaining('No local installed Bright CLI was found.')
      );
      expect(actual).toEqual(
        expect.stringContaining('No global installed was found.')
      );
    },
    60 * 1000
  );
});

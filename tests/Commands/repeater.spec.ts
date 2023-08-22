import { Cli, Api } from '../Setup';
import { URL } from 'url';
import { ChildProcess } from 'child_process';

const config = {
  cmd: process.env['E2E_CLI_CMD'],
  cluster: process.env['E2E_CLUSTER'],
  runId: process.env['E2E_RUN_ID'],
  apiKey: process.env['E2E_REPEATER_API_KEY'],
  targetUrl: process.env['E2E_REPEATER_TARGET_URL'],
  maxTestTimeout:
    parseInt(process.env['E2E_REPEATER_MAX_TEST_TIMEOUT'], 10) * 1000
};

describe('Repeater Command', () => {
  const name = `E2E: Repeater Bright CLI (${config.runId})`;
  const [cmd, ...args]: string[] = config.cmd.split(' ');
  const cli = new Cli(cmd, args);
  const targetHost = new URL(config.targetUrl).host;
  const api = new Api({
    baseUrl: `https://${config.cluster}`,
    apiKey: config.apiKey
  });

  let repeaterId: string;
  let commandProcess: ChildProcess;

  beforeEach(async () => {
    repeaterId = await api.createRepeater(name);
  }, 10000);

  afterEach(async () => {
    if (commandProcess) {
      commandProcess.stdin.destroy();
      commandProcess.stderr.destroy();
      commandProcess.stdout.destroy();
      commandProcess.kill('SIGTERM');
    }

    await api.deleteRepeater(repeaterId);
  }, 10000);

  it(
    `should run scan against ${config.targetUrl}`,
    async () => {
      // arrange
      commandProcess = cli.spawn('repeater', [
        '--token',
        config.apiKey,
        '--id',
        repeaterId,
        '--cluster',
        config.cluster
      ]);
      commandProcess.stdout.pipe(process.stdout);
      commandProcess.stderr.pipe(process.stderr);

      await api.waitForRepeaterToConnect(repeaterId);

      // act
      const scanId = await api.createScan({
        name,
        repeaters: [repeaterId],
        crawlerUrls: [config.targetUrl],
        smart: true
      });
      const scan = await api.waitForScanToFinish(scanId);

      // assert
      expect(scan.requests).toBeGreaterThan(0);
      expect(scan.entryPoints).toBeGreaterThan(0);
      expect(scan.targets).toEqual([targetHost]);
      expect(scan.status).toBe('done');
    },
    config.maxTestTimeout
  );

  it('should fail to start scan when repeater is not connected', async () => {
    // arrange

    // act
    const act = () =>
      api.createScan({
        name,
        repeaters: [repeaterId],
        crawlerUrls: [config.targetUrl],
        smart: true
      });

    // assert
    await expect(act).rejects.toThrow(
      '429 - "The repeater used for the scan is not connected. Connect the repeater and restart the scan."'
    );
  }, 10000);
});

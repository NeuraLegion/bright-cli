import { Cli, Api } from '../Setup';
import { URL } from 'node:url';
import { ChildProcess, spawn } from 'node:child_process';

const config = {
  version: process.env.E2E_CLI_VERSION,
  cmd: process.env.E2E_CLI_CMD,
  cluster: process.env.E2E_CLUSTER,
  apiKey: process.env.E2E_CLUSTER_API_KEY,
  runId: process.env.E2E_RUN_ID,
  projectId: process.env.E2E_PROJECT_ID,
  targetUrl: process.env['E2E_REPEATER_TARGET_URL'],
  targetCmd: process.env['E2E_REPEATER_TARGET_CMD'],
  maxTestTimeout: parseInt(process.env.E2E_TEST_TIMEOUT, 10) * 1000
};

describe('Repeater Command', () => {
  let name: string;
  let api: Api;
  let cli: Cli;
  let targetHost: string;
  let repeaterId: string;
  let targetProcess: ChildProcess;
  let commandProcess: ChildProcess;

  beforeAll(() => {
    const [cliCmd, ...cliArgs]: string[] = config.cmd.split(' ');
    cli = new Cli(cliCmd, cliArgs);
    name = `E2E: Repeater Bright CLI ${config.version} (${config.runId})`;
    targetHost = new URL(config.targetUrl).host;
    api = new Api({
      baseUrl: `https://${config.cluster}`,
      apiKey: config.apiKey,
      timeout: 60_000,
      spoofIP: true
    });
  });

  beforeEach(async () => {
    const [targetCmd, ...targetArgs]: string[] = config.targetCmd.split(' ');
    targetProcess = spawn(targetCmd, targetArgs, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env
      }
    });

    targetProcess.stdout.pipe(process.stdout);
    targetProcess.stderr.pipe(process.stderr);

    repeaterId = await api.createRepeater(name, config.projectId);
  }, 10000);

  afterEach(async () => {
    if (commandProcess) {
      commandProcess.stderr.destroy();
      commandProcess.stdout.destroy();
      commandProcess.kill('SIGTERM');
    }

    if (targetProcess) {
      targetProcess.stderr.destroy();
      targetProcess.stdout.destroy();
      targetProcess.kill('SIGTERM');
    }

    await api.deleteRepeater(repeaterId);
  }, 10000);

  describe('Default Transport', () => {
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
          slowEpTimeout: 5_000,
          targetTimeout: 3,
          poolSize: 50,
          projectId: config.projectId
        });
        const scan = await api.waitForScanToFinish(scanId);
        const connectivity = await api.getScanEntryPointsConnectivity(scanId);

        // assert
        expect(scan.requests).toBeGreaterThan(0);
        expect(scan.entryPoints).toBeGreaterThan(0);
        expect(connectivity.ok).toBeGreaterThan(0);
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
          slowEpTimeout: 5_000,
          targetTimeout: 3,
          poolSize: 50,
          projectId: config.projectId
        });

      // assert
      await expect(act).rejects.toThrow('Request failed with status code 429');
      await expect(act).rejects.toMatchObject({
        response: {
          status: 429,
          data: 'The repeater used for the scan is not connected. Connect the repeater and restart the scan.'
        }
      });
    }, 10000);
  });
});

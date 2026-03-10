import {
  config,
  createTestContext,
  setupBeforeAll,
  setupBeforeEach,
  teardownAfterEach,
  RepeaterTestContext
} from './setup';

describe('Repeater: Smoke Tests', () => {
  const ctx: RepeaterTestContext = createTestContext();

  beforeAll(() => {
    setupBeforeAll(ctx);
  });

  beforeEach(async () => {
    await setupBeforeEach(ctx);
  }, 10000);

  afterEach(async () => {
    await teardownAfterEach(ctx);
  }, 10000);

  it(
    `should run scan against ${config.targetUrl}`,
    async () => {
      ctx.commandProcess = ctx.cli.spawn('repeater', [
        '--token',
        config.apiKey,
        '--id',
        ctx.repeaterId,
        '--cluster',
        config.cluster
      ]);
      ctx.commandProcess.stdout.pipe(process.stdout);
      ctx.commandProcess.stderr.pipe(process.stderr);

      await ctx.api.waitForRepeater(ctx.repeaterId);

      const scanId = await ctx.api.createScan({
        name: ctx.name,
        repeaters: [ctx.repeaterId],
        tests: [
          'header_security',
          'sqli',
          'css_injection',
          'xss',
          'stored_xss',
          'ssti',
          'html_injection',
          'csrf'
        ],
        crawlerUrls: [config.targetUrl],
        projectId: config.projectId
      });
      const scan = await ctx.api.waitForScanToFinish(scanId);
      const connectivity = await ctx.api.getScanEntryPointsConnectivity(scanId);

      expect(scan.requests).toBeGreaterThan(0);
      expect(scan.entryPoints).toBeGreaterThan(0);
      expect(connectivity.ok).toBeGreaterThan(0);
      expect(scan.targets).toEqual([ctx.targetHost]);
      expect(scan.status).toBe('done');
    },
    config.maxTestTimeout
  );

  it('should fail to start scan when repeater is not connected', async () => {
    const act = () =>
      ctx.api.createScan({
        name: ctx.name,
        repeaters: [ctx.repeaterId],
        crawlerUrls: [config.targetUrl],
        projectId: config.projectId
      });

    await expect(act).rejects.toThrow('Request failed with status code 400');
    await expect(act).rejects.toMatchObject({
      response: {
        status: 400,
        data: 'The repeater used for the scan is not connected. Connect the repeater and restart the scan.'
      }
    });
  }, 10000);
});

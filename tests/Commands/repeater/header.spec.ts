import {
  config,
  createTestContext,
  setupBeforeAll,
  setupBeforeEach,
  teardownAfterEach,
  RepeaterTestContext
} from './setup';
import { randomUUID } from 'node:crypto';

describe('Repeater: Header', () => {
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
    'should run scan with custom headers passed to repeater',
    async () => {
      // arrange
      const customHeaderName = 'X-Custom-Header';
      const customHeaderValue = 'test-value';

      ctx.commandProcess = ctx.cli.spawn('repeater', [
        '--token',
        config.apiKey,
        '--id',
        ctx.repeaterId,
        '--cluster',
        config.cluster,
        '--header',
        `${customHeaderName}: ${customHeaderValue}`
      ]);
      ctx.commandProcess.stdout.pipe(process.stdout);
      ctx.commandProcess.stderr.pipe(process.stderr);

      await ctx.api.waitForRepeater(ctx.repeaterId);

      const entryPointId = await ctx.api.createProjectEntryPoint(
        config.projectId,
        {
          method: 'POST',
          url: new URL('/todo', config.targetUrl).toString(),
          body: JSON.stringify({ title: randomUUID() }),
          headers: { 'Content-Type': 'application/json' }
        },
        ctx.repeaterId
      );

      // act
      const scanId = await ctx.api.createScan({
        name: ctx.name,
        repeaters: [ctx.repeaterId],
        tests: ['html_injection'],
        entryPointIds: [entryPointId],
        projectId: config.projectId
      });
      const scan = await ctx.api.waitForScanToFinish(scanId);
      const entryPoints = await ctx.api.getScanEntryPoints(scanId);

      // assert
      expect(scan.requests).toBeGreaterThan(0);
      expect(scan.status).toBe('done');
      expect(entryPoints.length).toBeGreaterThan(0);

      expect(
        entryPoints.every(
          (ep) => ep.request?.headers?.[customHeaderName] === customHeaderValue
        )
      ).toBe(true);
    },
    config.maxTestTimeout
  );
});

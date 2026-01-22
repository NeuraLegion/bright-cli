import {
  config,
  createTestContext,
  setupBeforeAll,
  setupBeforeEach,
  teardownAfterEach,
  RepeaterTestContext
} from './setup';
import { wiremock } from '../../setup/wiremock';

describe('Repeater: Header', () => {
  const ctx: RepeaterTestContext = createTestContext();

  beforeAll(() => {
    setupBeforeAll(ctx);
  });

  beforeEach(async () => {
    await setupBeforeEach(ctx);
    await wiremock.clearAllRequests();
  }, 10000);

  afterEach(async () => {
    await wiremock.clearAllMappings();
    await teardownAfterEach(ctx);
  }, 10000);

  it(
    'should run scan with custom headers passed to repeater',
    async () => {
      const customHeaderName = 'X-Custom-Header';
      const customHeaderValue = 'test-value';

      await wiremock.register(
        {
          method: 'GET',
          endpoint: '/repeaters/headers'
        },
        {
          status: 200,
          body: 'OK',
          headers: { 'Content-Type': 'text/plain' }
        }
      );

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
          method: 'GET',
          url: `${config.wiremockUrl}/repeaters/headers`
        },
        ctx.repeaterId
      );

      const scanId = await ctx.api.createScan({
        name: ctx.name,
        repeaters: [ctx.repeaterId],
        tests: ['header_security'],
        entryPointIds: [entryPointId],
        projectId: config.projectId
      });
      await ctx.api.waitForScanToFinish(scanId);

      await wiremock.expectRequest({
        method: 'GET',
        endpoint: '/repeaters/headers',
        headers: { [customHeaderName]: customHeaderValue }
      });
    },
    config.maxTestTimeout
  );
});

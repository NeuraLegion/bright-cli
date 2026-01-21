import {
  config,
  createTestContext,
  setupBeforeAll,
  setupBeforeEach,
  teardownAfterEach,
  RepeaterTestContext
} from './setup';

describe('Repeater: Connection Lifecycle', () => {
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

  it('should connect repeater and verify status via API', async () => {
    const statusBefore = await ctx.api.getRepeaterStatus(ctx.repeaterId);
    expect(statusBefore.status).toBe('disconnected');

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

    const statusAfter = await ctx.api.getRepeaterStatus(ctx.repeaterId);
    expect(statusAfter.status).toBe('connected');
  }, 60000);

  it('should disconnect repeater when process is terminated', async () => {
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

    const statusConnected = await ctx.api.getRepeaterStatus(ctx.repeaterId);
    expect(statusConnected.status).toBe('connected');

    ctx.commandProcess.kill('SIGTERM');

    await ctx.api.waitForRepeater(ctx.repeaterId, {
      desiredStatus: 'disconnected'
    });

    const statusAfter = await ctx.api.getRepeaterStatus(ctx.repeaterId);
    expect(statusAfter.status).toBe('disconnected');

    ctx.commandProcess = null;
  }, 60000);

  it('should handle attempt to connect with same repeater ID twice', async () => {
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

    const output = await ctx.cli.exec('repeater', [
      '--token',
      config.apiKey,
      '--id',
      ctx.repeaterId,
      '--cluster',
      config.cluster
    ]);

    expect(output.toLowerCase()).toMatch(
      /already connected|error|failed|conflict/i
    );
  }, 60000);
});

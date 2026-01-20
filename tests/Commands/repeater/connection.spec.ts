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
    // arrange
    const statusBefore = await ctx.api.getRepeaterStatus(ctx.repeaterId);
    expect(statusBefore.status).toBe('disconnected');

    // act
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

    // assert
    const statusAfter = await ctx.api.getRepeaterStatus(ctx.repeaterId);
    expect(statusAfter.status).toBe('connected');
  }, 30000);

  it('should disconnect repeater when process is terminated', async () => {
    // arrange
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

    // act
    ctx.commandProcess.kill('SIGTERM');

    await ctx.api.waitForRepeater(ctx.repeaterId, {
      desiredStatus: 'disconnected'
    });

    // assert
    const statusAfter = await ctx.api.getRepeaterStatus(ctx.repeaterId);
    expect(statusAfter.status).toBe('disconnected');

    // cleanup
    ctx.commandProcess = null;
  }, 30000);

  it('should handle attempt to connect with same repeater ID twice', async () => {
    // arrange
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

    // act
    const output = await ctx.cli.exec('repeater', [
      '--token',
      config.apiKey,
      '--id',
      ctx.repeaterId,
      '--cluster',
      config.cluster
    ]);

    // assert
    expect(output.toLowerCase()).toMatch(
      /already connected|error|failed|conflict/i
    );
  }, 60000);
});

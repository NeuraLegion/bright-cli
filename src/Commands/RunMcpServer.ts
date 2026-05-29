import container from '../container';
import { BrightMcpServer } from '../Mcp';
import { LogLevel, logger } from '../Utils/Logger';
import { CommandModule } from 'yargs';

export class RunMcpServer implements CommandModule {
  public readonly command = 'mcp [options]';
  public readonly describe = 'Starts the Bright MCP server.';

  public async handler(): Promise<void> {
    logger.logLevel = LogLevel.SILENT;

    const server = container.resolve(BrightMcpServer);
    const shutdown = async () => {
      await server.close();
      process.exitCode = 0;
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    await server.start();
  }
}

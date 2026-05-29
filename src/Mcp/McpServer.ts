import {
  RepeaterRunToolContext,
  RepeaterRunToolInput,
  RepeaterIdInput,
  RepeaterStopToolInput
} from './DefaultRepeaterTools';
import { CliInfo } from '../Config/CliInfo';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
  ServerNotification,
  ServerRequest,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { delay, inject, injectable } from 'tsyringe';

type JsonObject = Record<string, unknown>;

export interface RepeaterTools {
  run(
    input: RepeaterRunToolInput,
    context?: RepeaterRunToolContext
  ): Promise<unknown>;
  stop(input: RepeaterStopToolInput): Promise<unknown>;
  status(input: RepeaterIdInput): unknown;
  stopAll?(): Promise<unknown>;
}

export const RepeaterTools: unique symbol = Symbol('RepeaterTools');

export interface BrightMcpServerOptions {
  version: string;
  transport?: Transport;
  repeaterRunCommand?: RepeaterTools;
}

@injectable()
export class BrightMcpServer {
  private readonly server: Server;
  private readonly transport = new StdioServerTransport();

  constructor(
    @inject(delay(() => CliInfo)) private readonly info: CliInfo,
    @inject(RepeaterTools) private readonly tools: RepeaterTools
  ) {
    this.server = new Server(
      {
        name: 'bright-cli',
        version: this.info.version
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    this.registerHandlers();
  }

  public start(): Promise<void> {
    return this.server.connect(this.transport);
  }

  public async close(): Promise<void> {
    await this.tools.stopAll?.();
    await this.server.close();
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.createTools()
    }));

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request, extra) =>
        this.callTool(request.params.name, request.params.arguments, extra)
    );
  }

  private createTools(): Tool[] {
    return [
      {
        name: 'runRepeater',
        description:
          'Start the Bright repeater by invoking the existing bright-cli repeater command.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description:
                'Repeater ID. Required and must be unique per running repeater process.'
            },
            hostname: {
              type: 'string',
              description: 'Bright application hostname.'
            }
          }
        }
      },
      {
        name: 'stopRepeater',
        description:
          'Stop the repeater process with the given id started by this MCP server.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Repeater id identifying the process to stop.'
            },
            signal: {
              type: 'string',
              enum: ['SIGTERM', 'SIGINT', 'SIGKILL'],
              description: 'Signal used to stop the repeater process.'
            },
            timeoutMs: {
              type: 'number',
              description: 'Milliseconds to wait before escalating to SIGKILL.'
            }
          }
        }
      },
      {
        name: 'repeaterStatus',
        description:
          'Return the current status for the repeater process with the given id.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Repeater id identifying the process to inspect.'
            }
          }
        }
      }
    ];
  }

  private async callTool(
    name: string,
    input = {} as JsonObject,
    extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
  ): Promise<CallToolResult> {
    try {
      const result = await this.executeTool(name, input, extra);

      return {
        content: [
          {
            type: 'text',
            text:
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error)
          }
        ]
      };
    }
  }

  private executeTool(
    name: string,
    input: JsonObject,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  ): Promise<unknown> {
    switch (name) {
      case 'runRepeater': {
        const runInput = input as unknown as RepeaterRunToolInput;

        return this.tools.run(runInput, {
          token: extra.authInfo?.token
        });
      }
      case 'stopRepeater':
        return this.tools.stop(input as unknown as RepeaterStopToolInput);
      case 'repeaterStatus':
        return Promise.resolve(
          this.tools.status(input as unknown as RepeaterIdInput)
        );
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

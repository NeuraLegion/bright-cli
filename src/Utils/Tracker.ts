import axios from 'axios';
import { Arguments } from 'yargs';

export interface Event {
  subject: SubjectType;
  event: EventType;
  properties: Record<string, unknown>;
}

enum SubjectType {
  CLI = 'cli'
}

export enum EventType {
  CLI_COMMAND = 'CLI command'
}

export class Tracker {
  // eslint-disable-next-line @typescript-eslint/require-await
  public static async trackCommandUsage(args: Arguments) {
    const baseUrl = args.api as string;
    const url = `${baseUrl}/api/v1/analytics/events`;
    const command = args._.join(' ');
    const event: Event = {
      subject: SubjectType.CLI,
      event: EventType.CLI_COMMAND,
      properties: {
        command,
        hostname: args.cluster || args.hostname,
        arguments: this.filterArguments({ ...args })
      }
    };

    // fire-and-forget, so command execution won't be delayed
    axios
      .post(url, event, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${args.token}`
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('Error tracking CLI-command event:', e.message);
      });
  }

  private static filterArguments(
    args: Record<string, any>
  ): Record<string, any> {
    const whitelist = [
      'b',
      'breakpoint',
      'bucket',
      'cluster',
      'hostname',
      'insecure',
      'interval',
      'log-level',
      'module',
      'param',
      'smart',
      'template',
      'test',
      'timeout',
      'tp',
      'type',
      'verbose'
    ];

    const filteredArgs: Record<string, any> = {};

    for (const key of Object.keys(args)) {
      if (whitelist.includes(key)) {
        filteredArgs[key] = args[key];
      }
    }

    return filteredArgs;
  }
}

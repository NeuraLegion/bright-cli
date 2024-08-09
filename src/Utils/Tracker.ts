import axios from 'axios';
import { Arguments } from 'yargs';

export class Tracker {
  public static async trackCommandUsage(args: Arguments) {
    const baseUrl = args.api as string;
    // TODO: replace with final analytics endpoint
    const url = `${baseUrl}/analytics/events`;
    const command = args._.join(' ');
    const data = {
      command,
      event: 'CLI-command',
      token: args.token,
      hostname: args.cluster || args.hostname,
      arguments: this.filterArguments({ ...args })
    };

    // Send CLI-command event
    try {
      await axios.post(url, data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('CLI-command error tracking event:', e.message);
    }
  }

  // Blacklist function to filter out arguments
  private static filterArguments(
    args: Record<string, any>
  ): Record<string, any> {
    const blacklist = [
      '_',
      '$0',
      't',
      'cluster',
      'hostname',
      'token',
      'password',
      'repeaterServer',
      'bus',
      'api'
    ];
    const filteredArgs: Record<string, any> = {};

    for (const key of Object.keys(args)) {
      if (!blacklist.includes(key)) {
        filteredArgs[key] = args[key];
      }
    }

    return filteredArgs;
  }
}

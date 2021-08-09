import { ok } from 'assert';
import { ChildProcess, spawn } from 'child_process';
import { URL } from 'url';
import { normalize } from 'path';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      pkg?: {
        entrypoint: string;
      };
    }
  }
}

export interface CommandArgs {
  command: string;
  args: string[];
  shell: boolean;
  windowsVerbatimArguments: boolean;
}

export interface ClusterArgs {
  api?: string;
  bus?: string;
  cluster?: string;
}

export interface ClusterUrls {
  api: string;
  bus: string;
}

export class Helpers {
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  private static readonly SHORT_UUID_PATTERN = /^[1-9a-z]{10,22}$/i;
  private static readonly META_CHARS_REGEXP = /([()\][%!^"`<>&|;, *?])/g;

  public static isUUID(value: string): boolean {
    ok(value, 'Value must be string');

    return this.UUID_PATTERN.test(value);
  }

  public static isShortUUID(value: string): boolean {
    ok(value, 'Value must be string');

    return this.SHORT_UUID_PATTERN.test(value);
  }

  public static getClusterUrls(args: ClusterArgs): ClusterUrls {
    let bus: string;
    let api: string;

    if (args.cluster) {
      if (args.api || args.bus) {
        throw new Error('Arguments api/bus and cluster are mutually exclusive');
      }
      let host = args.cluster;

      try {
        ({ host } = new URL(args.cluster as string));
      } catch {
        // noop
      }

      if (host === 'localhost') {
        bus = `amqp://${host}:5672`;
        api = `http://${host}:8000`;
      } else {
        bus = `amqps://amq.${host}:5672`;
        api = `https://${host}`;
      }
    } else {
      api = (args.api as string) ?? `https://nexploit.app`;
      bus = (args.bus as string) ?? `amqps://amq.nexploit.app:5672`;
    }

    return { api, bus };
  }

  public static spawn(
    options: {
      exclude?: string[];
      include?: string[];
      detached?: boolean;
    } = { detached: false }
  ): ChildProcess {
    const {
      command,
      args,
      windowsVerbatimArguments,
      shell
    } = Helpers.getExecArgs({
      spawn: true,
      excludeAll: true,
      include: options.include,
      exclude: options.exclude
    });

    return spawn(command, args, {
      shell,
      windowsVerbatimArguments,
      detached: !shell && options.detached,
      windowsHide: shell && options.detached
    });
  }

  public static getExecArgs(options?: {
    exclude?: string[];
    include?: string[];
    excludeAll?: boolean;
    escape?: boolean;
    spawn?: boolean;
  }): CommandArgs {
    options = {
      escape: true,
      excludeAll: false,
      spawn: false,
      ...(options ?? {})
    };

    let args: string[] = process.argv.slice(1);

    if (options.excludeAll) {
      args = args.slice(0, 1);
    }

    if (options.include) {
      args = [...args, ...options.include];
    }

    if (options.exclude) {
      args = args.filter((x: string) => !options.exclude.includes(x));
    }

    args = [...process.execArgv, ...args].filter((arg: string) =>
      process.pkg && !options.spawn
        ? !arg.startsWith(process.pkg.entrypoint)
        : true
    );

    let command = normalize(process.execPath);

    const shell = this.win();
    const windowsVerbatimArguments = shell && options.escape;

    if (windowsVerbatimArguments) {
      command = `"${command}"`;
      args = args.map(this.escapeShellArgument, this);
    }

    return {
      args,
      shell,
      command,
      windowsVerbatimArguments
    };
  }

  public static async pool<T, R>(
    poolLimit: number,
    items: Iterable<T>,
    iterator: (subject: T) => Promise<R>
  ): Promise<R[]> {
    const promises: Promise<R>[] = [];

    const poolPromises: Promise<void>[] = [];

    for (const item of items) {
      const promise = iterator(item);

      promises.push(promise);

      const poolMember: Promise<void> = promise.then(() => {
        poolPromises.splice(poolPromises.indexOf(poolMember), 1);
      });

      poolPromises.push(poolMember);

      if (poolPromises.length >= poolLimit) {
        await Promise.race(poolPromises);
      }
    }

    return Promise.all(promises);
  }

  public static wildcardToRegExp(s: string): RegExp {
    return new RegExp(`^${s.split(/\*+/).map(this.regExpEscape).join('.*')}$`);
  }

  public static selectEnumValue(
    enumType: Record<string, string>,
    caseAgnosticValue: string
  ): string | undefined {
    return Object.values(enumType).find(
      (x: string) =>
        x.toLowerCase().trim() === caseAgnosticValue.toLowerCase().trim()
    );
  }

  public static omit<T, K extends keyof T>(data: T): Omit<T, undefined | null> {
    return (Object.entries(data) as [K, T[K]][]).reduce(
      (acc: Omit<T, undefined | null>, [k, v]: [K, T[K]]) =>
        v == null ? acc : { ...acc, [k]: v },
      {} as Omit<T, undefined | null>
    );
  }

  public static split<T extends R[], R>(array: T, count: number): R[][] {
    ok(Array.isArray(array), 'First argument must be an instance of Array.');

    const countItemInChunk: number = Math.ceil(array.length / count);

    return Array(countItemInChunk)
      .fill(null)
      .map(
        (_value: string, i: number) =>
          array.slice(i * count, i * count + count) as R[]
      );
  }

  public static toArray<T>(enumeration: unknown): T[] {
    return [...Object.values(enumeration)] as T[];
  }

  public static parseHeaders(headers: string[] = []): Record<string, string> {
    ok(Array.isArray(headers), 'First argument must be an instance of Array.');

    return headers.reduce((acc: Record<string, string>, value: string) => {
      const [key, header]: [string, string] = this.parseHeader(value);

      return { ...acc, [key]: header };
    }, {});
  }

  // It's based on https://qntm.org/cmd
  private static escapeShellArgument(val: string): string {
    val = `${val}`;

    val = val.replace(/(\\*)"/g, '$1$1\\"');

    val = val.replace(/(\\*)$/, '$1$1');

    val = `"${val}"`;

    return val.replace(this.META_CHARS_REGEXP, '^$1');
  }

  private static parseHeader(header: string): [string, string] | undefined {
    ok(
      typeof header === 'string',
      'First argument must be an instance of String.'
    );

    if (header) {
      const [key, ...values]: string[] = header.split(':');

      return [key, values.join(':')].map((item: string) =>
        decodeURIComponent(item.trim())
      ) as [string, string];
    }
  }

  private static win(): boolean {
    return process.platform === 'win32';
  }

  /**
   * RegExp-escapes all characters in the given string.
   */
  private static regExpEscape(s: string): string {
    return s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  }
}

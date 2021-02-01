import { ok } from 'assert';

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
}

export class Helpers {
  public static getExecArgs(options?: {
    exclude?: string[];
    include?: string[];
    excludeAll?: boolean;
  }): CommandArgs {
    let args: string[] = process.argv.slice(2);

    if (options?.excludeAll) {
      args = [];
    }

    if (process.pkg?.entrypoint !== process.argv[1]) {
      args = [process.argv[1], ...args];
    }

    if (options?.include) {
      args = [...args, ...options.include];
    }

    if (options?.exclude) {
      args = args.filter((x: string) => !options.exclude.includes(x));
    }

    return {
      command: process.execPath,
      args: [...process.execArgv, ...args]
    };
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

  public static toArray<T>(enumeration: any): T[] {
    return [...Object.values(enumeration)] as T[];
  }

  public static parseHeaders(headers: string[] = []): Record<string, string> {
    ok(Array.isArray(headers), 'First argument must be an instance of Array.');

    return headers.reduce((acc: Record<string, string>, value: string) => {
      const [key, header]: [string, string] = this.parseHeader(value);

      return { ...acc, [key]: header };
    }, {});
  }

  public static encodeURL(str: string): string {
    let decodedStr: string;

    try {
      decodedStr = decodeURI(str);
    } catch {
      decodedStr = str;
    }

    return encodeURI(decodedStr).replace(/%5B/g, '[').replace(/%5D/g, ']');
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

  /**
   * RegExp-escapes all characters in the given string.
   */
  private static regExpEscape(s: string): string {
    return s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  }
}

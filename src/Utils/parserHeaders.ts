export const parseHeaders = (headers: string[] = []): Record<string, string> =>
  Object.fromEntries(headers.map((value: string) => parseHeader(value)));

const parseHeader = (header: string): [string, string] | undefined =>
  header
    ? (header
        .split(':', 2)
        .map((item: string) => decodeURIComponent(item.trim())) as [
        string,
        string
      ])
    : undefined;

import { MalformedHeaderLine } from './Request';
import { injectable } from 'tsyringe';

@injectable()
export class HeadersBuilder {
  public build({
    headers,
    malformedHeaderLines
  }: {
    headers: Record<string, string | string[]>;
    malformedHeaderLines?: readonly MalformedHeaderLine[];
  }): string[] {
    const allHeaders = this.buildHeaderLines(headers);

    if (!malformedHeaderLines?.length) {
      return allHeaders;
    }

    const malformedSorted = [...malformedHeaderLines].sort(
      (a, b) => a.index - b.index
    );

    for (const malformedLine of malformedSorted) {
      allHeaders.splice(malformedLine.index, 0, malformedLine.line);
    }

    return this.foldColonlessHeaders(allHeaders);
  }

  private buildHeaderLines(
    headers: Record<string, string | string[]>
  ): string[] {
    const lines: string[] = [];
    const entries = headers ? Object.entries(headers) : [];

    for (const [key, value] of entries) {
      if (!key) continue;

      const values = Array.isArray(value) ? value : [value];

      lines.push(...values.map((v) => `${key}: ${v ?? ''}`));
    }

    return lines;
  }

  /**
   * ADHOC: libcurl drops `CURLOPT_HTTPHEADER` entries that contain no colon.
   * Fold any such entry into the preceding entry by appending `\r\n<line>`;
   * libcurl sends the combined string verbatim, producing two wire lines.
   * A colon-less entry with no preceding entry cannot be injected this way
   * and is left in place (libcurl will still drop it — known limitation).
   */
  private foldColonlessHeaders(headers: string[]): string[] {
    const result: string[] = [];

    for (const header of headers) {
      if (!header.includes(':') && result.length > 0) {
        result[result.length - 1] += `\r\n${header}`;
      } else {
        result.push(header);
      }
    }

    return result;
  }
}

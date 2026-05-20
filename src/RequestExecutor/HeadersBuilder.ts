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

    return allHeaders;
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
}

/**
 * A non-throwing, string-only decomposition of a target URL, shared by every
 * consumer on the request-execute path.
 *
 * Motivation: the previous code split URL handling across two parsers — the
 * WHATWG `new URL()` (in the virtual-script and response-script lookups) and the
 * legacy `node:url` `parse()` (in curl configuration, proxy resolution, and
 * Kerberos gating). The two disagree on normalisation (IDNA, casing, port
 * handling), and `new URL()` THROWS on an authority defect, short-circuiting an
 * otherwise-deliverable scanner request into an `ERR_INVALID_URL` before it ever
 * reaches libcurl. This class replaces both with one decomposition that never
 * throws, so a malformed-authority URL travels all the way to libcurl and is
 * answered with libcurl's own returned error code (e.g. `CURLE_URL_MALFORMAT`)
 * rather than being rejected client-side.
 *
 * Design decisions:
 * - **D3 — hostname normalisation.** {@link TargetUrlParts.hostname} is
 *   raw-lowercased with NO IDNA/punycode conversion. This differs from the old
 *   WHATWG path for internationalised domains: `☃.net` stays `☃.net` (lowercased)
 *   instead of becoming `xn--n3h.net`. Virtual-script and proxy-domain matching
 *   therefore key on the raw hostname. Intentional; documented behaviour change.
 * - **D4 — unparseable authority means "skip".** When the URL has no authority,
 *   {@link TargetUrlParts.hostname} is `undefined`; consumers treat that as "no
 *   virtual script, no response script, no proxy, no Kerberos" rather than
 *   coercing a `null`/`undefined` hostname into the string `"null"` inside a
 *   `RegExp.test(...)`.
 *
 * The parser performs only string slicing — no `new URL`, no `node:url` `parse`.
 * The {@link TargetUrlParts.path} field preserves the raw path+query+hash with
 * no percent-encoding normalisation, because libcurl is driven with
 * `PATH_AS_IS` and every scanner-controlled path malformation must survive
 * byte-for-byte.
 */
export interface TargetUrlParts {
  /** Scheme WITH its trailing colon, e.g. `'http:'`; `undefined` when absent. */
  readonly scheme?: string;
  /** `hostname[:port]` as `configureCurl` needs it; `undefined` when absent. */
  readonly host?: string;
  /**
   * Lowercased hostname with no port, no IPv6 brackets, and no IDNA/punycode
   * normalisation (decision D3); `undefined` when no authority is present (D4).
   */
  readonly hostname?: string;
  /** `user:pass` userinfo for libcurl `USERPWD`; `undefined` when absent. */
  readonly userinfo?: string;
  /** Raw path+query+hash, never normalised. Defaults to `'/'`. */
  readonly path: string;
}

export class TargetUrl {
  private static readonly SCHEME_SEPARATOR = '://';

  /**
   * Decompose a URL string. Never throws. An unparseable authority yields
   * `hostname === undefined` (and `host`/`scheme`/`userinfo` as available).
   */
  public static parse(url: string): TargetUrlParts {
    const path = TargetUrl.extractPath(url);

    const separatorIndex = url.indexOf(TargetUrl.SCHEME_SEPARATOR);

    // Origin-form (no scheme://): there is no authority to decompose. Only the
    // path is meaningful; hostname stays undefined so consumers skip host-keyed
    // behaviour (D4).
    if (separatorIndex === -1) {
      return { path };
    }

    const scheme = url.slice(0, separatorIndex + 1); // include trailing ':'
    const afterScheme = url.slice(
      separatorIndex + TargetUrl.SCHEME_SEPARATOR.length
    );

    // The authority ends at the first path/query/hash delimiter.
    const authorityEnd = afterScheme.search(/[/?#]/);
    const authority =
      authorityEnd === -1 ? afterScheme : afterScheme.slice(0, authorityEnd);

    return TargetUrl.decomposeAuthority(scheme, authority, path);
  }

  /**
   * Replace the userinfo component of a URL with `***`, so a rejection message
   * can quote the offending value without leaking credentials
   * (`http://user:pass@host/` → `http://***@host/`). Never throws; when there is
   * no userinfo the input is returned unchanged.
   */
  public static redact(url: string): string {
    const separatorIndex = url.indexOf(TargetUrl.SCHEME_SEPARATOR);

    if (separatorIndex === -1) {
      return url;
    }

    const afterSchemeStart = separatorIndex + TargetUrl.SCHEME_SEPARATOR.length;
    const afterScheme = url.slice(afterSchemeStart);

    const authorityEnd = afterScheme.search(/[/?#]/);
    const authority =
      authorityEnd === -1 ? afterScheme : afterScheme.slice(0, authorityEnd);

    const atIndex = authority.lastIndexOf('@');

    if (atIndex === -1) {
      return url;
    }

    const rest = authorityEnd === -1 ? '' : afterScheme.slice(authorityEnd);

    return `${url.slice(0, afterSchemeStart)}***@${authority.slice(
      atIndex + 1
    )}${rest}`;
  }

  private static decomposeAuthority(
    scheme: string,
    authority: string,
    path: string
  ): TargetUrlParts {
    if (!authority) {
      return { scheme, path };
    }

    const atIndex = authority.lastIndexOf('@');
    const userinfo =
      atIndex === -1 ? undefined : authority.slice(0, atIndex) || undefined;
    const host = atIndex === -1 ? authority : authority.slice(atIndex + 1);

    return {
      scheme,
      path,
      ...(userinfo !== undefined ? { userinfo } : {}),
      ...(host ? { host } : {}),
      ...(host ? { hostname: TargetUrl.extractHostname(host) } : {})
    };
  }

  /**
   * Strip the port and IPv6 brackets from a `host` and lowercase it, with no
   * IDNA/punycode conversion (D3).
   */
  private static extractHostname(host: string): string {
    // Bracketed IPv6 literal: `[::1]` or `[::1]:8080`.
    if (host.startsWith('[')) {
      const closing = host.indexOf(']');

      if (closing !== -1) {
        return host.slice(1, closing).toLowerCase();
      }
    }

    const colonIndex = host.indexOf(':');
    const withoutPort = colonIndex === -1 ? host : host.slice(0, colonIndex);

    return withoutPort.toLowerCase();
  }

  /**
   * Extract the raw path+query+hash from a URL string without any
   * percent-encoding normalisation. Preserved verbatim from the previous
   * `HttpRequestExecutor.buildRawPath` so `PATH_AS_IS` behaviour is unchanged.
   */
  private static extractPath(url: string): string {
    const separatorIndex = url.indexOf(TargetUrl.SCHEME_SEPARATOR);
    const withoutProtocol =
      separatorIndex === -1
        ? url
        : url.slice(separatorIndex + TargetUrl.SCHEME_SEPARATOR.length);
    const pathStart = withoutProtocol.search(/[/?#]/);

    if (pathStart === -1) {
      return '/';
    }

    return withoutProtocol[pathStart] === '/'
      ? withoutProtocol.slice(pathStart)
      : `/${withoutProtocol.slice(pathStart)}`;
  }
}

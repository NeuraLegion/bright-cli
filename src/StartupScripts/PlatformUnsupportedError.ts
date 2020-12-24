export class PlatformUnsupportedError extends Error {
  constructor(os: string) {
    super(`Platform ${os} does not support`);
  }
}

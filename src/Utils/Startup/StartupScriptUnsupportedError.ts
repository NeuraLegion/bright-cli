export class StartupScriptUnsupportedError extends Error {
  constructor(platform: string) {
    super(`Unsupported platform ${platform} for startup script`);
  }
}

export interface StartupOptions {
  readonly name: string;
  readonly displayName?: string;
  readonly command: string;
  readonly args: string[];
}

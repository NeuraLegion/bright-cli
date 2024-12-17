export interface Polling {
  start(): Promise<void>;

  stop(): Promise<void>;
}

export interface PidStore {
  get(): Promise<number | undefined>;
  set(pid: number): Promise<void>;
}

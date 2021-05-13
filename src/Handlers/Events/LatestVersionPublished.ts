import { Event } from '../../Bus';

export class LatestVersionPublished implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly version: string,
    public readonly lastUsedVersion: string
  ) {}
}

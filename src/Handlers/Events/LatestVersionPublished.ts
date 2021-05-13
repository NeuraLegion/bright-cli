import { Event } from '../../Bus';

export class LatestVersionPublished implements Event {
  constructor(
    public readonly version: string,
    public readonly needToBeUpdated: boolean
  ) {}
}

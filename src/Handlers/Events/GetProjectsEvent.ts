import { IntegrationType } from '../../Integrations';
import { Event } from '../../Bus';

export class GetProjectsEvent implements Event {
  constructor(
    public readonly type: IntegrationType,
  ) {}
}

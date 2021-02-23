import { IntegrationType } from '../../Integrations';
import { Event } from '../../Bus';

export class GetProjects implements Event {
  constructor(
    public readonly type: IntegrationType,
  ) {}
}

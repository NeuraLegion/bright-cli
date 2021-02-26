import { IntegrationType } from '../../Integrations';
import { Event } from '../../Bus';

export class RequestProjects implements Event {
  constructor(public readonly type: IntegrationType) {}
}

import { IntegrationType, JiraIssue } from '../../Integrations';
import { Event } from '../../Bus';

export class RegisterIssue implements Event {
  constructor(
    public readonly type: IntegrationType,
    public readonly issue: JiraIssue
  ) {}
}

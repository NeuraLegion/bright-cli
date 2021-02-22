import { JiraIssue } from '../../Integrations';
import { Event } from '../../Bus';

export class RegisterIssue implements Event {
  constructor(public readonly issue: JiraIssue) {}
}

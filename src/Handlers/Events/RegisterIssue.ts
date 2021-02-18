import { JiraIssue } from '../../Integrations/JiraClient';
import { Event } from '../../Bus/Event';

export class RegisterIssue implements Event {
  constructor(public readonly issue: JiraIssue) {}
}

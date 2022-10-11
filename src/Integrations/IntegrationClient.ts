import { ConnectivityStatus } from './ConnectivityStatus';
import { IntegrationType } from './IntegrationType';
import { Project } from './Project';
import { Ticket } from './Ticket';

export interface TicketMetadata {
  url: string;
}

export interface IntegrationPingTracer {
  type: IntegrationType;

  ping(): Promise<ConnectivityStatus>;
}

export interface IntegrationClient<TTicket extends Ticket = Ticket>
  extends IntegrationPingTracer {
  getProjects(): Promise<Project[]>;

  createTicket(ticket: TTicket): Promise<TicketMetadata>;
}

export const IntegrationClient: unique symbol = Symbol('IntegrationClient');

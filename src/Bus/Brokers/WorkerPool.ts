import { ExecutionResult, Handler } from '../Handler';
import { Event } from '../Event';
import { logger } from '../../Utils';
import { BaseBus } from './BaseBus';
import { DependencyContainer, inject, injectable } from 'tsyringe';
import { ok } from 'assert';
import { Worker } from 'worker_threads';
import { EventEmitter, once } from 'events';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

const WORKER = `
const { workerData, parentPort, threadId } = require('worker_threads');

parentPort.on('message', async (msg) => {
  const { correlationId, handler, payload } = msg
  
  const data = await handler.handle(payload);

  parentPort.postMessage({ data, correlationId, workerId: threadId })
})
`.trim();

interface WorkerExecResult {
  data: ExecutionResult;
  correlationId: string;
  workerId: number;
}

interface BackLogTask {
  eventName: string;
  payload: Event;
  correlationId: string;
  handler: Handler<Event, ExecutionResult>;
}

export interface WorkerPoolOptions {
  workers: number;
  timeout?: number;
}

export const WorkerPoolOptions: unique symbol = Symbol('WorkerPoolOptions');

@injectable()
export class WorkerPool extends BaseBus {
  private readonly workers = new Map<number, Worker>();
  private readonly idle: number[] = [];
  private readonly backlog: BackLogTask[] = [];
  private readonly responseEmitter: EventEmitter;

  constructor(
    @inject(WorkerPoolOptions) private readonly options: WorkerPoolOptions,
    @inject('tsyringe') container: DependencyContainer
  ) {
    super(container);
    this.responseEmitter = new EventEmitter();
    this.responseEmitter.setMaxListeners(0);
  }

  public async destroy(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        setImmediate(() =>
          this.idle.length === this.workers.size ? resolve() : null
        );
      });

      logger.debug('All workers empty.');

      await Promise.all(
        [...this.workers.values()].map((x: Worker) => x.terminate())
      );

      this.clear();

      logger.log('Worker pool disconnected');
    } catch (err) {
      logger.error('Cannot terminate worker pool gracefully');
      logger.debug('Error on disconnect: %s', err.message);
    }
  }

  public async init(): Promise<void> {
    if (this.workers.size) {
      return;
    }

    Array.from({ length: this.options.workers }).forEach(() => {
      const worker = new Worker(WORKER, { eval: true });

      worker.on('message', (result: WorkerExecResult) =>
        this.consumeMessage(result)
      );

      worker.on('error', (err: Error) => {
        logger.error(err.message);
        this.idle.push(worker.threadId);
      });

      this.workers.set(worker.threadId, worker);
      this.idle.push(worker.threadId);
    });
  }

  public async dispatch<T extends Event>(
    eventName: string,
    payload: T
  ): Promise<ExecutionResult> {
    ok(this.workers.size, `Worker pool is terminating.`);

    const randomString = await promisify(randomBytes)(16);
    const correlationId = randomString.toString('hex').slice(0, 16);

    const handler:
      | Handler<Event, ExecutionResult>
      | undefined = this.getHandler(eventName);

    ok(handler, `Cannot find a handler for ${eventName} event.`);

    this.backlog.push({ eventName, payload, correlationId, handler });

    this.runNext();

    return once(this.responseEmitter, correlationId);
  }

  private consumeMessage(result: WorkerExecResult): void {
    const { correlationId, data } = result;
    this.responseEmitter.emit(correlationId, data);
    this.idle.push(result.workerId);
    this.runNext();
  }

  private runNext(): void {
    if (this.backlog.length === 0 || this.idle.length === 0) {
      return;
    }

    const task: BackLogTask = this.backlog.shift();
    const workerId: number = this.idle.shift();

    logger.debug(`Scheduling ${task.correlationId} on ${workerId}`);

    const worker: Worker = this.workers.get(workerId);

    ok(worker, `Cannot determine worker with ID: "${workerId}".`);

    worker.postMessage(task);
  }

  private clear(): void {
    this.idle.slice(0, this.idle.length);
    this.backlog.slice(0, this.idle.length);
    this.workers.clear();
    this.responseEmitter.removeAllListeners();
  }
}

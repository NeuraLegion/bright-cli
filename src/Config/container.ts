import 'reflect-metadata';
import { Bus, RabbitMQBus } from '../Bus';
import { DefaultRequestExecutor, RequestExecutor } from '../RequestExecutor';
import { DefaultVirtualScripts, VirtualScripts } from '../Scripts';
import {
  DefaultStartupManagerFactory,
  StartupManagerFactory
} from '../StartupScripts';
import {
  AMQConnectivity,
  Connectivity,
  FSTokens,
  HTTPConnectivity,
  KoaPlatform,
  Platform,
  TCPConnectivity,
  Tokens
} from '../Wizard';
import {
  BreakpointFactory,
  DefaultBreakpointFactory,
  DefaultPollingFactory,
  PollingFactory,
  RestScans,
  Scans
} from '../Scan';
import {
  Archives,
  BaseNexMockConverter,
  DefaultHarRecorder,
  DefaultParserFactory,
  HarRecorder,
  NexMockConverter,
  ParserFactory,
  RestArchives
} from '../Archive';
import { container } from 'tsyringe';

container
  .register('tsyringe', {
    useValue: container
  })
  .register(RequestExecutor, {
    useClass: DefaultRequestExecutor
  })
  .register(VirtualScripts, {
    useClass: DefaultVirtualScripts
  })
  .register(StartupManagerFactory, {
    useClass: DefaultStartupManagerFactory
  })
  .register(Bus, {
    useClass: RabbitMQBus
  })
  .register(Tokens, {
    useClass: FSTokens
  })
  .register(Connectivity, {
    useClass: HTTPConnectivity
  })
  .register(Connectivity, {
    useClass: TCPConnectivity
  })
  .register(Connectivity, {
    useClass: AMQConnectivity
  })
  .register(Platform, {
    useClass: KoaPlatform
  })
  .register(BreakpointFactory, {
    useClass: DefaultBreakpointFactory
  })
  .register(PollingFactory, {
    useClass: DefaultPollingFactory
  })
  .register(Scans, { useClass: RestScans })
  .register(Archives, { useClass: RestArchives })
  .register(ParserFactory, { useClass: DefaultParserFactory })
  .register(NexMockConverter, { useClass: BaseNexMockConverter })
  .register(HarRecorder, { useClass: DefaultHarRecorder });

export default container;

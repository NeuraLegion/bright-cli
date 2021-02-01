import 'reflect-metadata';
import { Bus, RabbitMQBus } from '../Bus';
import { DefaultRequestExecutor, RequestExecutor } from '../RequestExecutor';
import {
  DefaultVirtualScripts,
  FSScriptLoader,
  ScriptLoader,
  VirtualScripts
} from '../Scripts';
import {
  DefaultStartupManagerFactory,
  StartupManagerFactory
} from '../StartupScripts';
import {
  AMQConnectivity,
  Connectivity,
  FSTokens,
  HTTPConnectivity,
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
import { container, Lifecycle } from 'tsyringe';
import { ConnectivityAnalyzer } from 'src/Wizard/Services';

container
  .register('tsyringe', {
    useValue: container
  })
  .register(
    RequestExecutor,
    {
      useClass: DefaultRequestExecutor
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    VirtualScripts,
    {
      useClass: DefaultVirtualScripts
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    StartupManagerFactory,
    {
      useClass: DefaultStartupManagerFactory
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    Bus,
    {
      useClass: RabbitMQBus
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    Tokens,
    {
      useClass: FSTokens
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    Connectivity,
    {
      useClass: HTTPConnectivity
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    Connectivity,
    {
      useClass: TCPConnectivity
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    Connectivity,
    {
      useClass: AMQConnectivity
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    BreakpointFactory,
    {
      useClass: DefaultBreakpointFactory
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    PollingFactory,
    {
      useClass: DefaultPollingFactory
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(Scans, { useClass: RestScans }, { lifecycle: Lifecycle.Singleton })
  .register(
    Archives,
    { useClass: RestArchives },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    ParserFactory,
    { useClass: DefaultParserFactory },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    NexMockConverter,
    { useClass: BaseNexMockConverter },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    HarRecorder,
    { useClass: DefaultHarRecorder },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    ScriptLoader,
    {
      useClass: FSScriptLoader
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .registerSingleton(ConnectivityAnalyzer);

export default container;

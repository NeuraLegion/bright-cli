import 'reflect-metadata';
import { Bus, RabbitMQBus } from '../Bus';
import {
  Certificates,
  CertificatesLoader,
  HttpRequestExecutor,
  RequestExecutor,
  WsRequestExecutor
} from '../RequestExecutor';
import {
  DefaultVirtualScripts,
  FSScriptLoader,
  ScriptLoader,
  VirtualScripts
} from '../Scripts';
import { DefaultStartupManager, StartupManager } from '../StartupScripts';
import {
  AMQConnectivity,
  Connectivity,
  ConnectivityAnalyzer,
  DefaultConnectivityAnalyzer,
  FSTokens,
  HTTPConnectivity,
  Platform,
  ReadlinePlatform,
  TCPConnectivity,
  TracerouteConnectivity,
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
import { IntegrationClient, JiraIntegrationClient } from '../Integrations';
import { ConfigReader } from './ConfigReader';
import { DefaultConfigReader } from './DefaultConfigReader';
import { CliInfo } from './CliInfo';
import { CliBuilder } from './CliBuilder';
import {
  RepeaterServer,
  DefaultRepeaterServer,
  RepeaterCommandHub,
  DefaultRepeaterCommandHub,
  RuntimeDetector,
  DefaultRuntimeDetector
} from '../Repeater';
import { container, Lifecycle } from 'tsyringe';

container
  .register('tsyringe', {
    useValue: container
  })
  .register<CliInfo>(CliInfo, { useValue: new CliInfo(process.cwd()) })
  .register(
    RequestExecutor,
    {
      useClass: HttpRequestExecutor
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    Certificates,
    {
      useClass: CertificatesLoader
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    RequestExecutor,
    {
      useClass: WsRequestExecutor
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
    StartupManager,
    {
      useClass: DefaultStartupManager
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
    RuntimeDetector,
    { useClass: DefaultRuntimeDetector },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    RepeaterServer,
    {
      useClass: DefaultRepeaterServer
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    RepeaterCommandHub,
    {
      useClass: DefaultRepeaterCommandHub
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
    { useClass: TracerouteConnectivity },
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
  .register(
    ConnectivityAnalyzer,
    {
      useClass: DefaultConnectivityAnalyzer
    },
    { lifecycle: Lifecycle.Singleton }
  )
  .register(
    IntegrationClient,
    { useClass: JiraIntegrationClient },
    { lifecycle: Lifecycle.Singleton }
  )
  .register<Platform>(
    Platform,
    { useClass: ReadlinePlatform },
    { lifecycle: Lifecycle.Singleton }
  )
  .register<ConfigReader>(
    ConfigReader,
    { useClass: DefaultConfigReader },
    { lifecycle: Lifecycle.Singleton }
  )
  .register<CliBuilder>(CliBuilder, {
    useFactory: (deps) =>
      new CliBuilder({
        info: deps.resolve(CliInfo),
        configReader: deps.resolve(ConfigReader)
      })
  });

export default container;

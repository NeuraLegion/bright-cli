import 'reflect-metadata';
import {
  Certificates,
  CertificatesLoader,
  HttpRequestExecutor,
  RequestExecutor,
  WsRequestExecutor
} from './RequestExecutor';
import {
  DefaultVirtualScripts,
  FSScriptLoader,
  ScriptLoader,
  VirtualScripts
} from './Scripts';
import { DefaultStartupManager, StartupManager } from './StartupScripts';
import {
  AuthConnectivity,
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
} from './Wizard';
import {
  BreakpointFactory,
  DefaultBreakpointFactory,
  DefaultPollingFactory,
  PollingFactory,
  RestScans,
  Scans
} from './Scan';
import { EntryPoints, RestEntryPoints } from './EntryPoint';
import {
  Archives,
  DefaultParserFactory,
  ParserFactory,
  RestArchives
} from './Archive';
import { ConfigReader } from './Config/ConfigReader';
import { DefaultConfigReader } from './Config/DefaultConfigReader';
import { CliInfo } from './Config/CliInfo';
import { CliBuilder } from './Config/CliBuilder';
import {
  RepeaterServer,
  DefaultRepeaterServer,
  RepeaterCommandHub,
  DefaultRepeaterCommandHub,
  RuntimeDetector,
  DefaultRuntimeDetector,
  RepeaterLauncher,
  ServerRepeaterLauncher
} from './Repeater';
import { ProxyFactory, DefaultProxyFactory } from './Utils';
import { container, Lifecycle } from 'tsyringe';

container
  .register('tsyringe', {
    useValue: container
  })
  .register<CliInfo>(CliInfo, {
    useValue: new CliInfo(__dirname)
  })
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
      useClass: AuthConnectivity
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
    EntryPoints,
    { useClass: RestEntryPoints },
    { lifecycle: Lifecycle.Singleton }
  )
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
  })
  .register<ProxyFactory>(ProxyFactory, {
    useClass: DefaultProxyFactory
  })
  .register<RepeaterLauncher>(
    RepeaterLauncher,
    {
      useClass: ServerRepeaterLauncher
    },
    { lifecycle: Lifecycle.Singleton }
  );

export default container;

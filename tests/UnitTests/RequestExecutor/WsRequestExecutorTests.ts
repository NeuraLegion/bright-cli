import 'reflect-metadata';
import { Protocol, Request, RequestExecutorOptions, WsRequestExecutor } from '../../../src/RequestExecutor';
import { WsMockBuilder } from '../MockBuilders/WsMockBuilder';
import { expect } from 'chai';
import sinon from 'sinon';
import { Server } from 'ws';

describe('WsRequestExecutor Tests', () => {
  const port = 9088;
  let sut: WsRequestExecutor;
  const options: RequestExecutorOptions = { timeout: 5000 };
  let server: Server;
  beforeEach(()=> {
   sut = new WsRequestExecutor(options)
  });

  afterEach(()=>{
    server?.close();
  })

  it('Get Protocol returns ws', () => {
    expect(sut.protocol).to.equal(Protocol.WS)
  });

  it('Execute sent frame', async ()=> {
    //arrange
    const handler = sinon.spy();

    server = new WsMockBuilder(port)
        .echoOnMessage()
        .onMessage((_, msg) => handler(msg))
        .start();

    const text = 'test';
    const headers: Record<string, string| string []> = {'a': '1', 'b': '2'};
    const request = new Request({
      headers,
      body: text,
      url: `ws://localhost:${port}`});

    //act
    await sut.execute(request);

    //assert
    expect(handler.called).true;
    expect(handler.firstCall.firstArg).equal(text);
  })

  it('Execute received frame', async ()=> {
    //arrange
    server = new WsMockBuilder(port)
      .echoOnMessage()
      .start();

    const text = 'echo';
    const headers: Record<string, string| string []> = {'a': '1', 'b': '2'};
    const request = new Request({
      headers,
      body: text,
      url: `ws://localhost:${port}`});

    //act
    const response = await sut.execute(request);

    //assert
    expect(response.body).equal(text);
    expect(response.message).undefined;
    expect(response.errorCode).undefined;
    expect(response.protocol).equal(Protocol.WS);
    expect(headers).not.empty;
  })

  before(()=> options.timeout = 1)
  it('Execute returns timeout code when timeout occurs', async ()=> {
    //arrange
    const handler = sinon.spy();

    server = new WsMockBuilder(port)
      .echoOnMessage()
      .onMessage((_, msg) => handler(msg))
      .start();

    const text = 'test';
    const headers: Record<string, string| string []> = {'a': '1', 'b': '2'};
    const request = new Request({
      headers,
      body: text,
      url: `ws://localhost:${port}`});

    //act
    const response = await sut.execute(request);

    //assert
    // TODO
  })

  it('Execute returns error response when get socket error', async ()=> {})
  it('Execute returns error response  when get connection error', async ()=> {})
});
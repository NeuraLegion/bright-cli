import 'reflect-metadata';
import { Protocol, Request, RequestExecutorOptions, WsRequestExecutor } from '../../../src/RequestExecutor';
import { WsMockBuilder } from '../MockBuilders/WsMockBuilder';
import { should, expect } from 'chai';
import sinon from 'sinon';
import { Server } from 'ws';

should();

describe('WsRequestExecutor', () => {
  const port = 9089;
  let sut: WsRequestExecutor;
  const options: RequestExecutorOptions = {timeout: 1000};
  let server: Server;

  beforeEach(() => {
    sut = new WsRequestExecutor(options);
  });

  afterEach(() => {
    server?.close();
  });

  describe('protocol', () => {
    it('returns ws', () => {
      sut.protocol.should.be.equal(Protocol.WS);
    });
  });


  describe('Execute', () => {
    it('frame was sent', async () => {
      //arrange
      const handler = sinon.spy();

      server = new WsMockBuilder(port)
        .echoOnMessage()
        .onMessage((_, msg) => handler(msg))
        .start();

      const text = 'test';
      const headers: Record<string, string | string []> = { 'a': '1', 'b': '2' };
      const request = new Request({
        headers,
        body: text,
        url: `ws://localhost:${port}`
      });

      //act
      await sut.execute(request);

      //assert
      handler.called.should.be.true;
      handler.firstCall.firstArg.should.be.equal(text);
    });

    it('frame received', async () => {
      //arrange
      server = new WsMockBuilder(port)
        .echoOnMessage()
        .start();

      const text = 'echo';
      const headers: Record<string, string | string []> = { 'a': '1', 'b': '2' };
      const request = new Request({
        headers,
        body: text,
        url: `ws://localhost:${port}`
      });

      //act
      const response = await sut.execute(request);

      //assert
      response.body.should.be.equal(text);
      response.body.should.be.equal(text);
      response.protocol.should.be.equal(Protocol.WS);
      response.statusCode.should.be.equal(101);
      headers.should.be.not.empty;
      expect(response.message).undefined;
      expect(response.errorCode).undefined;
    });

    it('returns timeout code when timeout occurs', async () => {
      //arrange
      server = new WsMockBuilder(port)
        .echoOnMessage(1500)
        .start();

      const text = 'test';
      const headers: Record<string, string | string []> = { 'a': '1', 'b': '2' };
      const request = new Request({
        headers,
        body: text,
        url: `ws://localhost:${port}`
      });

      //act
      const response = await sut.execute(request);

      //assert
      response.errorCode.should.be.equal('ETIMEDOUT');
      response.protocol.should.be.equal(Protocol.WS);
      expect(response.body).undefined;
    });

    it('returns error response when connection closed', async () => {
      //arrange
      const reason = 'Error occurs';
      const closeCode = 1000

      server = new WsMockBuilder(port)
        .closeOnMessage(closeCode, reason)
        .start();

      const headers: Record<string, string | string []> = { 'a': '1', 'b': '2' };
      const request = new Request({
        headers,
        body: '123',
        url: `ws://localhost:${port}`
      });

      //act
      const response = await sut.execute(request);

      //assert
      response.protocol.should.be.equal(Protocol.WS);
      response.statusCode.should.be.equal(closeCode);
      response.body.should.be.equal(reason);
    });

    it('returns error response when get connection error', async () => {
      //arrange
      const text = 'test';
      const headers: Record<string, string | string []> = { 'a': '1', 'b': '2' };
      const request = new Request({
        headers,
        body: text,
        url: `ws://localhost:${port}`
      });

      //act
      const response = await sut.execute(request);

      //assert
      expect(response.body).undefined;
      response.protocol.should.be.equal(Protocol.WS);
      response.errorCode.should.be.equal('ECONNREFUSED')
      response.message.should.be.exist;
    });
  });
});
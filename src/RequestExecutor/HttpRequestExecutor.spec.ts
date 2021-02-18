import 'reflect-metadata';
import { Request } from './Request';
import { HttpRequestExecutor } from './HttpRequestExecutor';
import { VirtualScripts } from '../Scripts/VirtualScripts';
import { Protocol } from './Protocol';
import chai, { should } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { anyString, instance, mock, when } from 'ts-mockito';
import nock from 'nock'

chai.use(chaiAsPromised);
should();

describe('HttpRequestExecutor', () => {
  const options = {timeout: 5000};

  let vsMock: VirtualScripts;
  let sut: HttpRequestExecutor;

  beforeEach(() => {
    vsMock = mock<VirtualScripts>();
    sut = new HttpRequestExecutor(instance(vsMock), options);
  });
  afterEach(()=>{
    nock.cleanAll();
  })
  describe('protocol', () => {
    it('should return http', () => {
      sut.protocol.should.be.equal(Protocol.HTTP);
    });
  });

  describe('execute', () => {
    it('should return expected response', async () => {
      // arrange
      const baseUrl = 'https://api.github.com';
      const responseHeader = {'header': 'value'};
      const relativePath = '/repos/atom/atom/license'
      const responseText = 'response text'
      nock(baseUrl)
        .get(relativePath)
        .reply(200, responseText, responseHeader);

      const request = new Request({
        method: 'Get',
        url: `${baseUrl}${relativePath}`,
        headers: {requestHeader: 'value'}
      });

      when(vsMock.find(anyString()));

      // act
      const response = await sut.execute(request);

      //assert
      response.protocol.should.be.equal(Protocol.HTTP);
      response.body.should.be.equal(responseText);
      response.headers.should.deep.equal(responseHeader)
      response.statusCode.should.be.equal(200);
    });

    it('should return error response when failed', async function() {
      this.timeout(10000)
      const request = new Request({
        method: 'Get',
        url: 'http://mytest',
        headers: {requestHeader: 'value'}
      });

      when(vsMock.find(anyString()));

      // act
      const response = await sut.execute(request);

      //assert
      response.protocol.should.be.equal(Protocol.HTTP);
      response.errorCode.should.be.equal('ENOTFOUND');
      response.message.should.be.equal('getaddrinfo ENOTFOUND mytest');
    });

    it('should return timeout error', async () =>{
      options.timeout = 10;
      const request = new Request({
        method: 'Get',
        url: 'http://mytest',
        headers: {requestHeader: 'value'}
      });

      when(vsMock.find(anyString()));

      // act
      const response = await sut.execute(request);

      //assert
      response.protocol.should.be.equal(Protocol.HTTP);
      response.errorCode.should.be.equal('ETIMEDOUT');
      response.message.should.be.equal('ETIMEDOUT');
    });
  });
});
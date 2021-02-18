import { SendRequestHandler } from './SendRequestHandler';
import { Protocol, Request, RequestExecutor, Response } from '../RequestExecutor';
import chai, { should } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';

chai.use(chaiAsPromised);
should();


describe('SendRequestHandler', () => {
  const simpleEvent = {
    protocol: Protocol.HTTP,
    method: 'GET',
    url: 'http://test.con',
    headers: {},
    body: 'test'
  };

  const httpExecutorMock = mock<RequestExecutor>();
  when(httpExecutorMock.protocol).thenReturn(Protocol.HTTP);
  const wsExecutorMock = mock<RequestExecutor>();
  when(wsExecutorMock.protocol).thenReturn(Protocol.WS);


  let requestExecutors: RequestExecutor[];
  let sut: SendRequestHandler;
  beforeEach(() => {
    requestExecutors = [];
    sut = new SendRequestHandler(requestExecutors);
  });

  describe('handle', () => {
    it('should call matched RequestExecutor execute ', async () => {
      const response: Response = new Response({
        protocol: Protocol.HTTP,
        message: 'message',
        headers: {},
        errorCode: '1',
        statusCode: 10,
        body: 'body'
      });
      const request = new Request(simpleEvent)
      when(httpExecutorMock.execute(deepEqual(request))).thenResolve(response);

      requestExecutors.push(instance(httpExecutorMock));
      requestExecutors.push(instance(wsExecutorMock));

      // act
      await sut.handle(simpleEvent);

      // assert
      verify(wsExecutorMock.execute(anything())).never()
      verify(httpExecutorMock.execute(anything())).once()
    });

    it('should return expected response ', async () => {
      // arrange
      const response: Response = new Response({
        protocol: Protocol.HTTP,
        message: 'message',
        headers: {},
        errorCode: '1',
        statusCode: 10,
        body: 'body'
      });
      when(httpExecutorMock.execute(deepEqual(new Request(simpleEvent)))).thenResolve(response);

      requestExecutors.push(instance(httpExecutorMock))

      // act
      const forwardResponse = await sut.handle(simpleEvent);

      // assert
      forwardResponse.protocol.should.be.equal(response.protocol);
      forwardResponse.error_code.should.be.equal(response.errorCode);
      forwardResponse.headers.should.be.equal(response.headers);
      forwardResponse.body.should.be.equal(response.body);
      forwardResponse.message.should.be.equal(response.message);
      forwardResponse.status_code.should.be.equal(response.statusCode);
    });

    it('should throw error if RequestExecutor not found ', async () => {
      requestExecutors.push(wsExecutorMock);
      const act = () => sut.handle(simpleEvent);
      act().should.rejectedWith(/'Unsupported protocol *'/g);
    });
  });
});
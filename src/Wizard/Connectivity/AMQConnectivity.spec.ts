import 'reflect-metadata';
import { AMQConnectivity } from './AMQConnectivity';
import { Tokens } from '../Tokens';
import { instance, mock, reset, when } from 'ts-mockito';
import nock from 'nock';

describe('AMQConnectivity', () => {
  const tokensMock = mock<Tokens>();
  const url = new URL('http://example.com');

  let amqConnectivity!: AMQConnectivity;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    amqConnectivity = new AMQConnectivity(instance(tokensMock));
  });

  afterEach(() => {
    reset(tokensMock);
    nock.cleanAll();
    nock.restore();
  });

  afterAll(() => nock.enableNetConnect());

  describe('test', () => {
    it('should return true if the AMQ connectivity test is successful', async () => {
      // arrange
      const response = 'allow';
      nock(url.origin).post(url.pathname).reply(200, response);
      when(tokensMock.readTokens()).thenReturn({
        repeaterId: 'username',
        authToken: 'password'
      });

      // act
      const result = await amqConnectivity.test(url);

      // assert
      expect(result).toBe(true);
    });

    it('should return true if the AMQ returns a deny string', async () => {
      // arrange
      const response = 'deny';
      nock(url.origin).post(url.pathname).reply(200, response);
      when(tokensMock.readTokens()).thenReturn({
        repeaterId: 'username',
        authToken: 'password'
      });

      // act
      const result = await amqConnectivity.test(url);

      // assert
      expect(result).toBe(false);
    });

    it('should return false if the AMQ connectivity test fails', async () => {
      // arrange
      nock(url.origin).post(url.pathname).replyWithError('Test error');
      when(tokensMock.readTokens()).thenReturn({
        repeaterId: 'username',
        authToken: 'password'
      });

      // act
      const result = await amqConnectivity.test(url);

      // assert
      expect(result).toBe(false);
    });
  });
});

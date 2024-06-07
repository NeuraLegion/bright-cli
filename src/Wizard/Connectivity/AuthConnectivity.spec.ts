import 'reflect-metadata';
import { AuthConnectivity } from './AuthConnectivity';
import { Tokens } from '../Tokens';
import { instance, mock, reset, when } from 'ts-mockito';
import nock from 'nock';

describe('AuthConnectivity', () => {
  const tokensMock = mock<Tokens>();
  const url = new URL('http://example.com');

  let authConnectivity!: AuthConnectivity;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    authConnectivity = new AuthConnectivity(instance(tokensMock));
  });

  afterEach(() => {
    reset(tokensMock);
    nock.cleanAll();
    nock.restore();
  });

  afterAll(() => nock.enableNetConnect());

  describe('test', () => {
    it('should return true if the authentication test is successful', async () => {
      // arrange
      const response = { id: '1' };
      nock(url.origin).get('/api/v1/repeaters/1').reply(200, response);
      when(tokensMock.readTokens()).thenReturn({
        repeaterId: '1',
        authToken: 'token'
      });

      // act
      const result = await authConnectivity.test(url);

      // assert
      expect(result).toBe(true);
    });

    it('should return false if the authentication test fails', async () => {
      // arrange
      nock(url.origin).get('/api/v1/repeaters/1').reply(404, 'Not Found');
      when(tokensMock.readTokens()).thenReturn({
        repeaterId: '1',
        authToken: 'password'
      });

      // act
      const result = await authConnectivity.test(url);

      // assert
      expect(result).toBe(false);
    });
  });
});

import { CurlErrorMapper } from './CurlErrorMapper';
import { CurlCode, Easy } from '@brightsec/node-libcurl';
import { constants } from 'node:os';

describe('CurlErrorMapper', () => {
  describe('resolveCurlCode', () => {
    it('should return a numeric code reported by the binding', () => {
      // arrange
      const error = Object.assign(new Error('Request failed: whatever'), {
        code: CurlCode.CURLE_COULDNT_CONNECT
      });

      // act
      const result = CurlErrorMapper.resolveCurlCode(error);

      // assert
      expect(result).toBe(CurlCode.CURLE_COULDNT_CONNECT);
    });

    it.each([
      CurlCode.CURLE_COULDNT_RESOLVE_HOST,
      CurlCode.CURLE_COULDNT_CONNECT,
      CurlCode.CURLE_OPERATION_TIMEDOUT,
      CurlCode.CURLE_GOT_NOTHING,
      CurlCode.CURLE_RECV_ERROR,
      CurlCode.CURLE_SSL_CONNECT_ERROR
    ])(
      'should recover CURLcode %s from the message of a plain error',
      (curlCode) => {
        // arrange
        const error = new Error(`Request failed: ${Easy.strError(curlCode)}`);

        // act
        const result = CurlErrorMapper.resolveCurlCode(error);

        // assert
        expect(result).toBe(curlCode);
      }
    );

    it('should not resolve the generic libcurl description shared by several codes', () => {
      // arrange
      const error = new Error('Request failed: Unknown error');

      // act
      const result = CurlErrorMapper.resolveCurlCode(error);

      // assert
      expect(result).toBeUndefined();
    });

    it('should not resolve an error that does not come from libcurl', () => {
      // arrange
      const error = Object.assign(new Error('Script failed'), {
        code: 'ERR_SCRIPT'
      });

      // act
      const result = CurlErrorMapper.resolveCurlCode(error);

      // assert
      expect(result).toBeUndefined();
    });
  });

  describe('toErrorCode', () => {
    it.each([
      [CurlCode.CURLE_COULDNT_RESOLVE_HOST, 'ENOTFOUND'],
      [CurlCode.CURLE_COULDNT_RESOLVE_PROXY, 'ENOTFOUND'],
      [CurlCode.CURLE_COULDNT_CONNECT, 'ECONNREFUSED'],
      [CurlCode.CURLE_OPERATION_TIMEDOUT, 'ETIMEDOUT'],
      [CurlCode.CURLE_GOT_NOTHING, 'ECONNRESET'],
      [CurlCode.CURLE_SEND_ERROR, 'EPIPE'],
      [CurlCode.CURLE_RECV_ERROR, 'ECONNRESET'],
      [CurlCode.CURLE_SSL_CONNECT_ERROR, 'EPROTO']
    ])('should map CURLcode %s to %s', (curlCode, expected) => {
      // act
      const result = CurlErrorMapper.toErrorCode(curlCode);

      // assert
      expect(result).toBe(expected);
    });

    it.each([
      [CurlCode.CURLE_COULDNT_CONNECT, 'EHOSTUNREACH'],
      [CurlCode.CURLE_COULDNT_CONNECT, 'ENETUNREACH'],
      [CurlCode.CURLE_COULDNT_CONNECT, 'ECONNREFUSED'],
      [CurlCode.CURLE_RECV_ERROR, 'ECONNRESET'],
      [CurlCode.CURLE_SEND_ERROR, 'ECONNRESET']
    ])(
      'should prefer the OS errno for socket-level CURLcode %s reported with %s',
      (curlCode, errnoName) => {
        // arrange
        const osErrno =
          constants.errno[errnoName as keyof typeof constants.errno];

        // act
        const result = CurlErrorMapper.toErrorCode(curlCode, osErrno);

        // assert
        expect(result).toBe(errnoName);
      }
    );

    it('should ignore the OS errno for non-socket CURLcodes', () => {
      // arrange
      const staleErrno = constants.errno.ECONNREFUSED;

      // act
      const result = CurlErrorMapper.toErrorCode(
        CurlCode.CURLE_OPERATION_TIMEDOUT,
        staleErrno
      );

      // assert
      expect(result).toBe('ETIMEDOUT');
    });

    it.each([0, undefined, -1])(
      'should fall back to the CURLcode mapping when the OS errno is %s',
      (osErrno) => {
        // act
        const result = CurlErrorMapper.toErrorCode(
          CurlCode.CURLE_COULDNT_CONNECT,
          osErrno
        );

        // assert
        expect(result).toBe('ECONNREFUSED');
      }
    );

    it('should return the symbolic libcurl name for an unmapped CURLcode', () => {
      // act
      const result = CurlErrorMapper.toErrorCode(
        CurlCode.CURLE_UNSUPPORTED_PROTOCOL
      );

      // assert
      expect(result).toBe('CURLE_UNSUPPORTED_PROTOCOL');
    });

    it('should return a string code for an unknown CURLcode', () => {
      // act
      const result = CurlErrorMapper.toErrorCode(9999 as CurlCode);

      // assert
      expect(result).toBe('CURLE_9999');
    });
  });
});

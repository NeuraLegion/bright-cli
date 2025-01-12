import { Logger, LogLevel, LogFile } from '../Logger';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('Logger', () => {
  let logger: Logger;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  let mockLogFile: LogFile;
  let tempDir: string;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation();
    tempDir = join(
      os.tmpdir(),
      'logger-test-' + Math.random().toString(36).substring(7)
    );
    mkdirSync(tempDir, { recursive: true });

    mockLogFile = {
      write: jest.fn(),
      end: jest.fn()
    };
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      logger = new Logger();
      expect(logger.logLevel).toBe(LogLevel.NOTICE);
      expect(logger.logFile).toBeUndefined();
    });

    it('should initialize with custom log level', () => {
      logger = new Logger(LogLevel.ERROR);
      expect(logger.logLevel).toBe(LogLevel.ERROR);
    });

    it('should initialize with custom log file', () => {
      const logPath = join(tempDir, 'test.log');
      logger = new Logger(LogLevel.NOTICE, logPath);
      expect(logger.logFile).toBe(logPath);
    });
  });

  describe('logging methods', () => {
    beforeEach(() => {
      logger = new Logger(LogLevel.TRACE);
      (logger as any)._logFile = mockLogFile;
    });

    it('should log error messages', () => {
      logger.error('test error');
      expect(stderrSpy).toHaveBeenCalled();
      expect(mockLogFile.write).toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      const error = new Error('test error');
      logger.error(error);
      expect(stderrSpy).toHaveBeenCalled();
      expect(mockLogFile.write).toHaveBeenCalled();
      const logCall = mockLogFile.write.mock.calls[0][0];
      expect(logCall).toContain('test error');
      expect(logCall).toContain(error.stack);
    });

    it('should log warning messages', () => {
      logger.warn('test warning');
      expect(stdoutSpy).toHaveBeenCalled();
      expect(mockLogFile.write).toHaveBeenCalled();
    });

    it('should log notice messages', () => {
      logger.log('test notice');
      expect(stdoutSpy).toHaveBeenCalled();
      expect(mockLogFile.write).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      logger.debug('test debug');
      expect(stdoutSpy).toHaveBeenCalled();
      expect(mockLogFile.write).toHaveBeenCalled();
    });

    it('should log trace messages', () => {
      logger.trace('test trace');
      expect(stdoutSpy).toHaveBeenCalled();
      expect(mockLogFile.write).toHaveBeenCalled();
    });

    it('should not log when level is below threshold', () => {
      logger.logLevel = LogLevel.ERROR;
      logger.warn('test warning');
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(mockLogFile.write).not.toHaveBeenCalled();
    });

    it('should format messages with arguments', () => {
      logger.log('test %s %d', 'string', 123);
      const logCall = mockLogFile.write.mock.calls[0][0];
      expect(logCall).toContain('test string 123');
    });
  });

  describe('log file handling', () => {
    it('should create log directory if it does not exist', () => {
      const logPath = join(tempDir, 'nested', 'test.log');
      logger = new Logger(LogLevel.NOTICE, logPath);
      expect(logger.logFile).toBe(logPath);
    });

    it('should close previous log file when setting new one', () => {
      logger = new Logger();
      (logger as any)._logFile = mockLogFile;

      const logPath = join(tempDir, 'test.log');
      logger.logFile = logPath;

      expect(mockLogFile.end).toHaveBeenCalled();
    });

    it('should handle write errors gracefully', () => {
      logger = new Logger();
      (logger as any)._logFile = {
        write: () => {
          throw new Error('Write error');
        }
      };

      expect(() => {
        logger.log('test message');
      }).not.toThrow();
    });
  });
});

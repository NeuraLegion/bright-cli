import { Helpers } from './Helpers';
import { should, expect } from 'chai';

enum TestEnum {
  TEST = 'test',
  PROD = 'prod'
}

should();

describe('Helpers', () => {
  describe('getClusterUrls', () => {
    it('should throw error when --cluster and --bus used', () => {
      // arrange
      const args = {
        bus: 'amqps://localhost:5672',
        cluster: 'localhost'
      };
      // act
      const act = () => Helpers.getClusterUrls(args);
      //assert
      act.should.to.throw(
        'Arguments api/bus and cluster are mutually exclusive'
      );
    });

    it('should throw error when --cluster and --api used', () => {
      // arrange
      const args = {
        api: 'http://localhost:8000',
        cluster: 'localhost'
      };
      // act
      const act = () => Helpers.getClusterUrls(args);
      //assert
      act.should.to.throw(
        'Arguments api/bus and cluster are mutually exclusive'
      );
    });

    it('should returns localhost api and bus if --cluster is localhost', () => {
      // arrange
      const args = {
        cluster: 'localhost'
      };
      // act
      const result = Helpers.getClusterUrls(args);
      //assert
      result.api.should.be.equal('http://localhost:8000');
      result.bus.should.be.equal('amqp://localhost:5672');
    });

    it('should returns default values if --cluster, --bus and --api not used', () => {
      // arrange
      const args = {};
      // act
      const result = Helpers.getClusterUrls(args);
      //assert
      result.api.should.be.equal('https://app.neuralegion.com');
      result.bus.should.be.equal('amqps://amq.app.neuralegion.com:5672');
    });

    it('should returns values with --cluster option', () => {
      // arrange
      const args = {
        cluster: 'test.com'
      };
      // act
      const result = Helpers.getClusterUrls(args);
      //assert
      result.api.should.be.equal('https://test.com');
      result.bus.should.be.equal('amqps://amq.test.com:5672');
    });

    it('should returns values with --api and --bus option', () => {
      // arrange
      const args = {
        api: 'https://test.com',
        bus: 'amqps://rabbit.test.com'
      };
      // act
      const result = Helpers.getClusterUrls(args);
      //assert
      result.api.should.be.equal('https://test.com');
      result.bus.should.be.equal('amqps://rabbit.test.com');
    });
  });

  describe('getExecArgs', () => {
    it('should return current exec args', () => {
      const { args, command } = Helpers.getExecArgs();
      command.should.eq(process.execPath);
      args.should.have.members([...process.execArgv, ...process.argv.slice(1)]);
    });

    it('should return exec args excluding all app args', () => {
      const { args, command } = Helpers.getExecArgs({ excludeAll: true });
      command.should.eq(process.execPath);
      args.should.have.members([process.argv[1]]);
    });

    it('should return exec args including extra args', () => {
      const extraArgs = ['--run'];
      const { args, command } = Helpers.getExecArgs({ include: extraArgs });
      command.should.eq(process.execPath);
      args.should.have.members([
        ...process.execArgv,
        ...process.argv.slice(1),
        ...extraArgs
      ]);
    });

    it('should return exec args excluding specific args', () => {
      const excessArgs = [...process.argv].slice(-2);
      const { args, command } = Helpers.getExecArgs({ exclude: excessArgs });
      command.should.eq(process.execPath);
      args.should.have.members([
        ...process.execArgv,
        ...process.argv.slice(1, process.argv.length - 2)
      ]);
    });
  });

  describe('wildcardToRegExp', () => {
    [
      { wildcard: '*.example.com', input: 'sub.example.com', expected: true },
      {
        wildcard: '*.example.com',
        input: 'sub.sub.example.com',
        expected: true
      },
      { wildcard: '*.example.com', input: 'examp1e.com', expected: false },
      { wildcard: '*.example.com', input: 'example.co', expected: false },
      { wildcard: '*', input: 'sub.example.co', expected: true },
      { wildcard: '*', input: 'sub.sub.example.co', expected: true },
      { wildcard: '*', input: 'example.com', expected: true }
    ].forEach(({ wildcard, input, expected }) => {
      it(`regexp '${wildcard}' tests '${input}' ${
        expected ? 'positive' : 'negative'
      }`, () => {
        // arrange
        const regex = Helpers.wildcardToRegExp(wildcard);
        // act
        const test = regex.test(input);
        // assert
        test.should.be.equal(expected);
      });
    });
  });

  describe('selectEnumValue', () => {
    it('should found with case agnostic', () => {
      //arrange
      //act
      const actual = Helpers.selectEnumValue(TestEnum, 'TesT');
      //assert
      actual.should.be.equal(TestEnum.TEST);
    });
    it('should returns undefined', () => {
      //arrange
      //act
      const actual = Helpers.selectEnumValue(TestEnum, 'Staging');
      //assert
      expect(actual).to.be.undefined;
    });
  });

  describe('omit', () => {
    it('should returns valid object', () => {
      // arrange
      const input = {
        a: 1,
        b: 2,
        c: null as number,
        d: undefined as number,
        e: 3
      };
      // act
      const actual = Helpers.omit(input);
      // assert
      actual.should.be.deep.equal({ a: 1, b: 2, e: 3 });
    });
  });

  describe('split', () => {
    it('should split even array', () => {
      // arrange
      const items = [1, 2, 3, 4];
      // act
      const actual = Helpers.split(items, 2);
      // assert
      actual.should.be.deep.equal([
        [1, 2],
        [3, 4]
      ]);
    });
    it('should split odd array', () => {
      // arrange
      const items = [1, 2, 3, 4, 5];
      // act
      const actual = Helpers.split(items, 2);
      // assert
      actual.should.be.deep.equal([[1, 2], [3, 4], [5]]);
    });
    it('should split empty array', () => {
      const items: string[] = [];

      const actual = Helpers.split(items, 3);

      actual.should.be.deep.equal([]);
    });
  });
  describe('toArray', () => {
    it('should return array', () => {
      // arrange
      // act
      const actual = Helpers.toArray(TestEnum);
      // assert
      actual.should.to.be.an('array');
      actual.should.to.be.deep.equal([TestEnum.TEST, TestEnum.PROD]);
    });
  });
  describe('parseHeaders', () => {
    it('should return empty object', () => {
      // arrange
      const input: string[] = [];

      // act
      const actual = Helpers.parseHeaders(input);

      // assert
      actual.should.be.empty;
    });

    it('should returns pairs of key/value even if value omitted', () => {
      // arrange
      const input: string[] = ['header1', 'header2: value2'];

      // act
      const actual = Helpers.parseHeaders(input);

      // assert
      actual['header1'].should.be.empty;
      actual['header2'].should.be.equal('value2');
      actual.should.have.keys(['header1', 'header2']);
    });

    it('should throw error', () => {
      const act = () => Helpers.parseHeaders({} as string[]);

      //assert
      act.should.to.throw('First argument must be an instance of Array.');
    });
  });
});

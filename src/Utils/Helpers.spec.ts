import { Helpers } from './Helpers';
import { should, expect } from 'chai';

enum TestEnum {
  TEST = 'test',
  PROD = 'prod'
}

should();

describe('Helpers', () => {
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
   //   { wildcard: '*.example.com', input: 'example.com', expected: true },
      { wildcard: '*.example.com', input: 'sub.example.com', expected: true },
      { wildcard: '*.example.com',input: 'sub.sub.example.com', expected: true },
      { wildcard: '*.example.com',input: 'examp1e.com', expected: false },
      { wildcard: '*.example.com',input: 'example.co', expected: false },
      { wildcard: '*',input: 'sub.example.co', expected: true },
      { wildcard: '*',input: 'sub.sub.example.co', expected: true },
      { wildcard: '*',input: 'example.com', expected: true },

    ].forEach(({wildcard,  input, expected }) => {
      it(`regexp '${wildcard}' tests '${input}' ${expected ? 'positive' : 'negative'}`, () => {
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
    it('not found should return undefined', () => {
      //arrange
      //act
      const actual = Helpers.selectEnumValue(TestEnum, 'Staging');
      //assert
      expect(actual).to.be.undefined;
    });
  });
  describe('return valid object', () => {
    // arrange
    const input = 'test';
    // act
    const actual = Helpers.omit(input);
    // assert
    actual.should.be.deep.equal({ 0: 't', 1: 'e', 2: 's', 3: 't' });
  });
  describe('split', () => {
    it('should even array', () => {
      // arrange
      const items = [1, 2, 3, 4];
      // act
      const actual = Helpers.split(items, 2);
      // assert
      actual.should.be.deep.equal([[1, 2], [3, 4]]);
    });
    it('should odd array', () => {
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
      const enumeration = 'abc';
      // act
      const actual = Helpers.toArray(enumeration);
      // assert
      actual.should.to.be.an('array');
      actual.should.to.be.deep.equal(['a', 'b', 'c']);
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

    it('should valid object', () => {
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
      // @ts-ignore
      const act = () => Helpers.parseHeaders({});

      //assert
      act.should.to.throw('First argument must be an instance of Array.');
    });
  });

  describe('encodeURL', () => {
    [
      {
        input: 'https://mozilla.org/?x=шеллы',
        expected: 'https://mozilla.org/?x=%D1%88%D0%B5%D0%BB%D0%BB%D1%8B'
      },
      {
        input: 'test',
        expected: 'test'
      },
      {
        input: 'https://mozilla.org/api/v1/test?query=[\'1\',"2"]',
        expected: 'https://mozilla.org/api/v1/test?query=[\'1\',%222%22]'
      }
    ].forEach(({ input, expected }) => {
      it(`${input} should become ${expected}`, () => {
        const actual = Helpers.encodeURL(input);

        actual.should.be.equal(expected);
      });
    });
  });

});

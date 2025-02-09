import Qs from 'qs';

import type { SomeSchema } from '../src';
import {
  pipe,
  refine,
  minArrayLength,
  λ,
  minStringLength,
  tuple,
  unknown,
  array,
  boolean,
  date,
  isSchema,
  nil,
  nullable,
  number,
  object,
  oneOf,
  optional,
  string,
  validate,
} from '../src';
import { schemaToString } from '../src/stringify';
import { isISODateString } from '../src/utils/dateUtils';

describe('@typeofweb/schema unit tests', () => {
  const simpleValidators: ReadonlyArray<() => SomeSchema<any>> = [boolean, date, number, string];
  const objectValidator = object({});
  const arrayValidator = array(string());
  const literalValidator = oneOf(['a']);
  const allValidators = [...simpleValidators, objectValidator, arrayValidator, literalValidator];
  const modifiers: ReadonlyArray<
    { bivarianceHack(schema: SomeSchema<any>): SomeSchema<any> }['bivarianceHack']
  > = [nil, nullable, optional];

  describe('validation', () => {
    it('string validator should coerce Date to ISOString', () => {
      expect(validate(string())(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
    });

    it('number validator should coerce string to number', () => {
      expect(validate(number())('3')).toBe(3);
    });

    it('number validator should not coerce empty string to 0', () => {
      expect(() => validate(number())('')).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected number but got \\"\\"!"`,
      );
    });

    it("isISODateString should return false for '0'", () => {
      expect(isISODateString('0')).toBe(false);
    });

    it('date validator should not accept invalid date', () => {
      expect(() => validate(date())(new Date(' '))).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected Date but got null!"`,
      );
    });

    it('date validator should not accept invalid ISODateString', () => {
      expect(() =>
        validate(date())('123456789123456789123456789'),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected Date but got \\"123456789123456789123456789\\"!"`,
      );
    });

    it('date validator should coerce ISOString to Date', () => {
      expect(validate(date())('1970-01-01T00:00:00.000Z')).toEqual(new Date(0));
    });

    it('date validator should coerce ISOString to Date', () => {
      expect(validate(date())('1995-12-17T02:24:00.000Z')).toEqual(
        new Date('Sun Dec 17 1995 03:24:00 GMT+0100 (Central European Standard Time)'),
      );
    });

    it("date validator should not coerce '0' to ISOString", () => {
      expect(() => validate(date())('0')).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected Date but got \\"0\\"!"`,
      );
    });

    it('date validator should not coerce invalid string', () => {
      expect(() => validate(date())('abc')).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected Date but got \\"abc\\"!"`,
      );
    });

    it('date validator should coerce ISODateString that starts with +/-', () => {
      expect(validate(date())('+010000-01-01T00:00:00.000Z')).toEqual(
        new Date('Sat Jan 01 10000 01:00:00 GMT+0100 (Central European Standard Time)'),
      );
    });

    it('should allow optional fields', () => {
      const personSchema = object({
        name: string(),
        age: number(),
        email: optional(string()),
      })();

      expect(
        validate(personSchema)({
          name: 'Mark',
          age: 29,
        }),
      ).toEqual({
        name: 'Mark',
        age: 29,
      });

      expect(
        validate(personSchema)({
          name: 'Mark',
          age: 29,
          email: undefined,
        }),
      ).toEqual({
        name: 'Mark',
        age: 29,
      });

      expect(
        validate(personSchema)({
          name: 'Mark',
          age: 29,
          email: 'email',
        }),
      ).toEqual({
        name: 'Mark',
        age: 29,
        email: 'email',
      });

      expect(() =>
        validate(personSchema)({
          name: 'Mark',
          age: 29,
          email: 123123123,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected { name: string, age: number, email: (string | undefined) } but got {\\"name\\":\\"Mark\\",\\"age\\":29,\\"email\\":123123123}!"`,
      );
    });

    it('should not allow optional fields be passed instead of required', () => {
      const user = object({
        name: string(),
        age: optional(number()),
      })();
      expect(() => validate(user)({ age: 23 })).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected { name: string, age: (number | undefined) } but got {\\"age\\":23}!"`,
      );
    });

    it('should not allow unknown fields instead of optional', () => {
      const user = object({
        name: string(),
        age: optional(number()),
      })();
      expect(() => validate(user)({ name: '32', x: 23 })).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected { name: string, age: (number | undefined) } but got {\\"name\\":\\"32\\",\\"x\\":23}!"`,
      );
    });

    it('should detect schemas', () => {
      expect.assertions(allValidators.length * (modifiers.length + 1));

      allValidators.forEach((v) => {
        expect(isSchema(v())).toBe(true);
        modifiers.forEach((m) => {
          expect(isSchema(m(v()))).toBe(true);
        });
      });
    });

    it('should fail minLength for non-string values', () => {
      expect(() => validate(minStringLength(10)(string()))({})).toThrowError();
    });

    it('should handle more complex case', () => {
      const schema = object({
        name: minStringLength(4)(string()),
        email: string(),
        firstName: minStringLength(1)(string()),
        phone: minStringLength(1)(string()),
        age: number(),
      })();
      const validator = validate(schema);

      const obj = {
        name: 'John Doe',
        email: 'john.doe@company.space',
        firstName: 'John',
        phone: '123-4567',
        age: 33,
      };

      expect(() => validator(obj)).not.toThrow();
    });

    it('unknown() should allow missing keys in object', () => {
      const schema = object({
        name: minStringLength(4)(string()),
        email: unknown(),
      })();
      const validator = validate(schema);

      const obj = {
        name: 'John Doe',
      };

      expect(() => validator(obj)).not.toThrow();
    });

    it(`object() should work with objects with null prototype`, () => {
      const schema = object({
        name: string(),
      })();
      const validator = validate(schema);

      const obj = Object.create(null, { name: { value: 'halo', enumerable: true } }) as object;

      expect(validator(obj)).toEqual({ name: 'halo' });
    });

    it(`object() should work with sealed and frozen objects`, () => {
      const schema = object({
        name: string(),
      })();
      const validator = validate(schema);

      const obj1 = Object.seal({ name: 'jeden' });
      const obj2 = Object.freeze({ name: 'dwa' });
      const obj3 = Object.preventExtensions({ name: 'trzy' });

      expect(validator(obj1)).toEqual({ name: 'jeden' });
      expect(validator(obj2)).toEqual({ name: 'dwa' });
      expect(validator(obj3)).toEqual({ name: 'trzy' });
    });

    it(`object() should strip non-enumerable properties when validating`, () => {
      const schema = object({
        name: string(),
      })();
      const validator = validate(schema);

      const obj = Object.create(null, {
        name: { value: 'halo', enumerable: true },
        sneaky: { value: 'spy', enumerable: false },
      }) as object;

      expect(validator(obj)).toEqual({ name: 'halo' });
      expect((validator(obj) as Record<string, any>)['sneaky']).toEqual(undefined);
    });

    it(`object() should not mutate existing objects`, () => {
      const schema = object({
        name: string(),
      })();
      const validator = validate(schema);

      const obj = Object.create(null, {
        name: { value: 'halo', enumerable: true, writable: true, configurable: true },
        sneaky: { value: 'spy', enumerable: false, writable: true, configurable: true },
      }) as Record<string, any>;

      const result = validator(obj);

      expect(result).toEqual({ name: 'halo' });
      expect(result === obj).toEqual(false);

      (result as Record<string, any>).name = 'blabla';

      expect(obj.name).toEqual('halo');
      expect(obj.sneaky).toEqual('spy');
    });

    it('tuple should validate given items in given order', () => {
      const schema = object({
        a: tuple([])(),
        b: tuple([1, 2, 3])(),
        c: tuple([number(), string()])(),
        d: nullable(tuple([string()])()),
      })();
      const validator = validate(schema);

      const obj = {
        a: [],
        b: [1, 2, 3],
        c: [241231, 'aaaa'],
        d: null,
      };

      expect(() => validator(obj)).not.toThrow();
    });

    it('tuple should throw on invalid values', () => {
      const validator1 = validate(tuple([])());
      const validator2 = validate(tuple([1, 2, 3])());
      const validator3 = validate(tuple([number(), string()])());
      const validator4 = validate(tuple([1, 2, 3, number(), string()])());

      expect(() => validator1([1, 2, 3])).toThrow();
      expect(() => validator2([1, 3, 2])).toThrow();
      expect(() => validator3('hello')).toThrow();
      expect(() => validator4([1, 2, 3, 42, null])).toThrow();
    });

    it('object should throw on unknown keys', () => {
      const validator = validate(
        object({
          a: number(),
          b: string(),
          c: array(string())(),
          d: object({ e: string(), f: oneOf([string(), false])() })(),
        })(),
      );

      expect(() =>
        validator({ '': [], ' ': [], '!': {}, '"': {} }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected { a: number, b: string, c: string[], d: { e: string, f: (string | false) } } but got {\\"\\":[],\\" \\":[],\\"!\\":{},\\"\\\\\\"\\":{}}!"`,
      );
    });

    it('object should not throw on unknown keys when allowUnknownKeys option is true', () => {
      const validator = validate(
        object(
          {
            a: number(),
            b: string(),
            c: array(string())(),
            d: object({ e: string(), f: oneOf([string(), false])() })(),
          },
          { allowUnknownKeys: true },
        )(),
      );

      const obj = {
        a: 1,
        b: '2',
        c: ['Hello'],
        d: {
          e: 'World',
          f: false,
        },
        g: 34,
        h: 'Prop',
        i: [{ name: 'John' }, { name: 'Mark' }],
      };

      expect(() => validator(obj)).not.toThrow();
      expect(validator(obj)).toEqual({
        a: 1,
        b: '2',
        c: ['Hello'],
        d: {
          e: 'World',
          f: false,
        },
        g: 34,
        h: 'Prop',
        i: [{ name: 'John' }, { name: 'Mark' }],
      });
    });

    it('should throw on when array was expected but not given', () => {
      const validator = validate(array(string())());
      expect(() => validator(42)).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected string[] but got 42!"`,
      );
    });

    it('should throw on invalid values in arrays', () => {
      const validator = validate(array(object({ a: string() })())());
      expect(() => validator([123])).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected { a: string }[] but got [123]!"`,
      );
    });

    it('should throw when deeply nested object fails', () => {
      const validator = validate(
        object({
          a: number(),
          b: object({
            c: string(),
            d: object({
              e: array(
                object({
                  f: string(),
                })(),
              )(),
            })(),
          })(),
        })(),
      );

      expect(() =>
        validator({
          a: 1,
          b: {
            c: 'aaa',
            d: {
              e: [
                {
                  f: 'bbb',
                },
                {
                  f: 123, // fails
                },
              ],
            },
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Invalid type! Expected { a: number, b: { c: string, d: { e: { f: string }[] } } } but got {\\"a\\":1,\\"b\\":{\\"c\\":\\"aaa\\",\\"d\\":{\\"e\\":[{\\"f\\":\\"bbb\\"},{\\"f\\":123}]}}}!"`,
      );
    });

    it('should only accept arrays with at least 0 elements when [false] is given', () => {
      const primitiveValidators: readonly ((schema?: SomeSchema<any>) => SomeSchema<any>)[] = [
        number,
        string,
        date,
        boolean,
      ];
      expect(
        λ(array(...primitiveValidators.map((v) => v())), minArrayLength(0), validate)([false]),
      );
    });

    it('should not accept arrays with at least 1 element when [] is given', () => {
      const primitiveValidators: readonly ((schema?: SomeSchema<any>) => SomeSchema<any>)[] = [
        number,
        string,
        date,
        boolean,
      ];
      expect(() =>
        λ(array(...primitiveValidators.map((v) => v())), minArrayLength(1), validate)([]),
      ).toThrow();
    });

    it('should exit early if one of the validators in oneOf returns right', () => {
      const spy = jest.fn();
      const shouldNotBeCalled = refine((value) => {
        spy(value);
        throw new Error(String(value));
      });
      const validator = pipe(oneOf([string(), nullable(number()), shouldNotBeCalled()]), validate);
      expect(validator(null)).toEqual(null);
      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('nil should allow undefined or null', () => {
      expect(validate(nil())(null)).toEqual(null);
      expect(validate(nil())(undefined)).toEqual(undefined);
      expect(() => validate(nil())('aaaa')).toThrow();
    });

    it('parse and validate fields in objects #49', () => {
      const queryString = `dateFrom=2020-10-15&dateTo=2020-10-15&resultsPerPage=10`;

      const parsedQuery = Qs.parse(queryString);

      const queryValidator = validate(
        object({
          dateFrom: date(),
          dateTo: date(),
          resultsPerPage: number(),
        })(),
      );

      const queryObject = queryValidator(parsedQuery);
      expect(queryObject.dateFrom).toBeInstanceOf(Date);
      expect(queryObject.dateTo).toBeInstanceOf(Date);
      expect(queryObject.resultsPerPage).toEqual(10);
    });

    it('skip non-existent optional fields in objects #50', () => {
      const a = object({
        key1: optional(string()),
        key2: optional(string()),
      })();
      const validatorA = validate(a);

      const value = validatorA({
        key1: 'hello',
      });

      expect(value).toHaveProperty('key1', 'hello');
      expect(value).not.toHaveProperty('key2');
    });

    it('do not skip undefined optional fields in objects #50', () => {
      const a = object({
        key1: optional(string()),
        key2: optional(string()),
      })();
      const validatorA = validate(a);

      const value = validatorA({
        key1: 'hello',
        key2: undefined,
      });

      expect(value).toHaveProperty('key1', 'hello');
      expect(value).toHaveProperty('key2', undefined);
    });
  });

  describe('schemaToString', () => {
    it('should work for simple validators', () => {
      expect(schemaToString(string())).toMatchInlineSnapshot(`"string"`);
      expect(schemaToString(number())).toMatchInlineSnapshot(`"number"`);
      expect(schemaToString(boolean())).toMatchInlineSnapshot(`"boolean"`);
      expect(schemaToString(date())).toMatchInlineSnapshot(`"Date"`);
      expect(schemaToString(unknown())).toMatchInlineSnapshot(`"unknown"`);
    });

    it('should work for oneOf', () => {
      expect(schemaToString(oneOf([1])())).toMatchInlineSnapshot(`"1"`);
      expect(schemaToString(oneOf([string()])())).toMatchInlineSnapshot(`"string"`);
      expect(schemaToString(oneOf([1, 2, 3])())).toMatchInlineSnapshot(`"(1 | 2 | 3)"`);
      expect(schemaToString(oneOf(['a', 'b', 'c'])())).toMatchInlineSnapshot(
        `"(\\"a\\" | \\"b\\" | \\"c\\")"`,
      );
      expect(schemaToString(oneOf(['a', 'b', 12, 'c'])())).toMatchInlineSnapshot(
        `"(\\"a\\" | \\"b\\" | 12 | \\"c\\")"`,
      );
      expect(schemaToString(oneOf([1, 2, string(), 3, boolean()])())).toMatchInlineSnapshot(
        `"(1 | 2 | string | 3 | boolean)"`,
      );
    });

    it('should work for arrays', () => {
      expect(schemaToString(array(number())())).toMatchInlineSnapshot(`"number[]"`);
      expect(schemaToString(array(string())())).toMatchInlineSnapshot(`"string[]"`);
      expect(schemaToString(array(string(), boolean())())).toMatchInlineSnapshot(
        `"(string | boolean)[]"`,
      );
      expect(schemaToString(array(unknown())())).toMatchInlineSnapshot(`"unknown[]"`);
    });

    it('should work for objects', () => {
      expect(schemaToString(object({})())).toMatchInlineSnapshot(`"{}"`);
      expect(schemaToString(object({ a: string() })())).toMatchInlineSnapshot(`"{ a: string }"`);
      expect(
        schemaToString(object({ a: string(), b: number(), 'no elo koleś': boolean() })()),
      ).toMatchInlineSnapshot(`"{ a: string, b: number, \\"no elo koleś\\": boolean }"`);
    });

    it('should work for tuples', () => {
      expect(schemaToString(tuple(['a', string(), number()])())).toMatchInlineSnapshot(
        `"[\\"a\\", string, number]"`,
      );
      expect(schemaToString(tuple(['a'])())).toMatchInlineSnapshot(`"[\\"a\\"]"`);
      expect(schemaToString(tuple([number(), oneOf(['s', 'm', 'h'])()])())).toMatchInlineSnapshot(
        `"[number, (\\"s\\" | \\"m\\" | \\"h\\")]"`,
      );
      expect(
        schemaToString(tuple([number(), tuple([string(), oneOf(['s', 'm', 'h'])()])()])()),
      ).toMatchInlineSnapshot(`"[number, [string, (\\"s\\" | \\"m\\" | \\"h\\")]]"`);
    });

    it('should work for deeply nested objects', () => {
      expect(
        schemaToString(
          object({
            a: string(),
            b: number(),
            'no elo koleś': boolean(),
            c: object({ e: array(oneOf([array(string())(), object({ xxx: number() })()])())() })(),
          })(),
        ),
      ).toMatchInlineSnapshot(
        `"{ a: string, b: number, \\"no elo koleś\\": boolean, c: { e: (string[] | { xxx: number })[] } }"`,
      );
    });

    it('should work for simple validators with modifiers', () => {
      expect(schemaToString(optional(string()))).toMatchInlineSnapshot(`"(string | undefined)"`);
      expect(schemaToString(nullable(string()))).toMatchInlineSnapshot(`"(string | null)"`);
      expect(schemaToString(optional(number()))).toMatchInlineSnapshot(`"(number | undefined)"`);
      expect(schemaToString(nullable(number()))).toMatchInlineSnapshot(`"(number | null)"`);
      expect(schemaToString(optional(boolean()))).toMatchInlineSnapshot(`"(boolean | undefined)"`);
      expect(schemaToString(nullable(boolean()))).toMatchInlineSnapshot(`"(boolean | null)"`);
      expect(schemaToString(optional(date()))).toMatchInlineSnapshot(`"(Date | undefined)"`);
      expect(schemaToString(nullable(date()))).toMatchInlineSnapshot(`"(Date | null)"`);
    });

    it('should work for oneOf with modifiers', () => {
      expect(schemaToString(optional(oneOf([1])()))).toMatchInlineSnapshot(`"(1 | undefined)"`);
      expect(schemaToString(nullable(oneOf([string()])()))).toMatchInlineSnapshot(
        `"(string | null)"`,
      );
      expect(schemaToString(nullable(oneOf([1, 2, 3])()))).toMatchInlineSnapshot(
        `"((1 | 2 | 3) | null)"`,
      );
      expect(
        schemaToString(oneOf([1, 2, optional(string()), 3, boolean()])()),
      ).toMatchInlineSnapshot(`"(1 | 2 | (string | undefined) | 3 | boolean)"`);
    });

    it('should work for arrays with modifiers', () => {
      expect(schemaToString(array(number())())).toMatchInlineSnapshot(`"number[]"`);
      expect(schemaToString(array(string())())).toMatchInlineSnapshot(`"string[]"`);
      expect(schemaToString(array(string(), boolean())())).toMatchInlineSnapshot(
        `"(string | boolean)[]"`,
      );
    });

    it('should work for objects with modifiers', () => {
      expect(schemaToString(optional(object({})()))).toMatchInlineSnapshot(`"({} | undefined)"`);
      expect(schemaToString(nullable(object({ a: string() })()))).toMatchInlineSnapshot(
        `"({ a: string } | null)"`,
      );
      expect(
        schemaToString(nil(object({ a: string(), b: number(), 'no elo koleś': boolean() })())),
      ).toMatchInlineSnapshot(
        `"({ a: string, b: number, \\"no elo koleś\\": boolean } | undefined | null)"`,
      );
    });

    it('should work for deeply nested objects with modifiers', () => {
      expect(
        schemaToString(
          object({
            a: optional(string()),
            b: number(),
            'no elo koleś': boolean(),
            c: object({
              e: nullable(
                array(oneOf([optional(array(string())()), object({ xxx: number() })()])())(),
              ),
            })(),
          })(),
        ),
      ).toMatchInlineSnapshot(
        `"{ a: (string | undefined), b: number, \\"no elo koleś\\": boolean, c: { e: (((string[] | undefined) | { xxx: number })[] | null) } }"`,
      );
    });
  });
});

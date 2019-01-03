import { tokenize, evaluate } from "../src/domain";

describe("tokenizer", () => {
  test("basic properties", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("1")).toEqual([{ type: "value", value: 1 }]);
    expect(tokenize("1 2")).toEqual([
      { type: "value", value: 1 },
      { type: "value", value: 2 }
    ]);
    expect(tokenize("-1")).toEqual([{ type: "value", value: -1 }]);
    expect(tokenize("OR")).toEqual([{ type: "or" }]);
    expect(tokenize("AND")).toEqual([{ type: "and" }]);
    expect(tokenize("=")).toEqual([{ type: "=" }]);
    expect(tokenize("(")).toEqual([{ type: "open" }]);
    expect(tokenize("abc")).toEqual([{ type: "field", value: "abc" }]);
    expect(tokenize('"abc"')).toEqual([{ type: "value", value: "abc" }]);
    expect(tokenize('"abc"')).toEqual([{ type: "value", value: "abc" }]);
  });

  test("tokenizer and parenthesis", () => {
    expect(tokenize("(1 2)")).toEqual([
      { type: "open" },
      { type: "value", value: 1 },
      { type: "value", value: 2 },
      { type: "close" }
    ]);
    expect(tokenize("(()")).toEqual([
      { type: "open" },
      { type: "open" },
      { type: "close" }
    ]);
    expect(tokenize("(a = 1)")).toEqual([
      { type: "open" },
      { type: "field", value: "a" },
      { type: "=" },
      { type: "value", value: 1 },
      { type: "close" }
    ]);
  });

  test("tokenizer and strings", () => {
    expect(tokenize('"hello world"')).toEqual([
      { type: "value", value: "hello world" }
    ]);
  });
});

describe("domain evaluation", () => {
  test("basic domain expressions", () => {
    expect(evaluate('hello = "world"', { id: "1", hello: "world" })).toBe(true);
    expect(evaluate('hello = "world"', { id: "1", hello: "not world" })).toBe(
      false
    );
    expect(evaluate("a = 1", { id: "1", a: 1 })).toBe(true);
    expect(evaluate("a = 1 AND b = 2", { id: "1", a: 1, b: 2 })).toBe(true);
    expect(evaluate("a = 1 AND b = 4", { id: "1", a: 1, b: 2 })).toBe(false);
    expect(evaluate("a = 13 OR b = 2", { id: "1", a: 1, b: 2 })).toBe(true);
  });

  test("basic domain expressions, with parenthesis", () => {
    expect(evaluate("(a = 1)", { id: "1", a: 1 })).toBe(true);
    expect(
      evaluate("(a = 1) AND (b = 1 OR (c = 3))", { id: "1", a: 1, b: 2, c: 3 })
    ).toBe(true);
  });

  test("throw errors if invalid expression", () => {
    expect(() => {
      evaluate("and", { id: "1", a: 1 });
    }).toThrow();

    expect(() => {
      evaluate("a = 1 and b = 2", { id: "1", a: 1, b: 2 });
    }).toThrow();
    expect(() => {
      evaluate("(", { id: "1", a: 1 });
    }).toThrow();
  });

  test("and/or precedence", () => {
    expect(
      evaluate("a = 1 AND b = 1 OR c = 3", { id: "1", a: 1, b: 2, c: 3 })
    ).toBe(true);
    expect(
      evaluate("a = 1 OR b = 2 AND c = 3", { id: "1", a: 1, b: 2, c: 4 })
    ).toBe(true);
  });

  test("empty domain should always match", () => {
    expect(evaluate("", { id: "1", a: 1 })).toBe(true);
  });
});

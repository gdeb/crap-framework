import { AST, Predicate, Record, Token } from "./types";

//------------------------------------------------------------------------------
// TOKENIZER
//------------------------------------------------------------------------------

/**
 * Converts a domain described by a string into a list of tokens.
 *
 * Note that this tokenizer is quite naive. For example, it will tokenize a
 * string "some  word" into "some word", because I am lazy and this is good
 * enough for my current needs.
 *
 * This method can throw errors if the string is not valid.  For example:
 * 'abc = "', or '-'.
 */
export function tokenize(domain: string): Token[] {
  const parts = domain.match(/\w+(?:'\w+)?|[^\w\s]/g) || [];
  const result: Token[] = [];
  let next: string | undefined, n: number, part: string | undefined;

  while ((part = parts.shift())) {
    switch (part) {
      case "AND":
        result.push({ type: "and" });
        break;
      case "OR":
        result.push({ type: "or" });
        break;
      case "=":
        result.push({ type: "=" });
        break;
      case "(":
        result.push({ type: "open" });
        break;
      case ")":
        result.push({ type: "close" });
        break;
      case '"':
        let words: string[] = [];
        while ((next = parts.shift())) {
          if (!next) throw new Error("missing closing quote for string token");
          if (next === '"') break;
          words.push(next);
        }
        part = words.join(" ");
        result.push({ type: "value", value: part });
        break;
      case "-":
        next = parts.shift();
        if (!next) {
          throw new Error("a negative sign should have a number after");
        }
        n = Number(next);
        result.push({ type: "value", value: -1 * n });
        break;
      default:
        n = Number(part);
        if (isNaN(n)) {
          result.push({ type: "field", value: part });
        } else {
          result.push({ type: "value", value: n });
        }
    }
  }
  return result;
}

//------------------------------------------------------------------------------
// PARSER
//------------------------------------------------------------------------------

const BINDING_POWERS = {
  field: 0,
  value: 0,
  close: 5,
  open: 5,
  "=": 10,
  or: 14,
  and: 15
};

/**
 * Parses a list of tokens into a domain AST.
 *
 * This method will throw errors if the token list does not represent a valid
 * domain.  For example, the token list ['AND'] is not a valid domain.
 */
export function parse(tokens: Token[]): AST {
  if (tokens.length === 0) {
    return { type: "empty" };
  }
  const result = _parse(tokens, 0);
  if (tokens.length > 0) {
    throw new Error("parse error, incomplete expression");
  }
  return result;
}

function nextBP(tokens: Token[]): number {
  return tokens[0] ? BINDING_POWERS[tokens[0].type] : 0;
}

function _parse(tokens: Token[], bp: number): AST {
  const token = tokens.shift();
  if (!token) {
    throw new Error("parse error, nothing to parse");
  }
  let result = _parsePrefix(token, tokens);
  while (nextBP(tokens) > bp) {
    let next = tokens.shift()!;
    result = _parseInfix(result, next, tokens);
  }
  return result;
}

function _parsePrefix(current: Token, tokens: Token[]): AST {
  if (current.type === "open") {
    const result = _parse(tokens, 5);
    const closing = tokens.shift();
    if (!closing || closing.type !== "close") {
      throw new Error("parse error, unmatched parenthesis");
    }
    return result;
  }
  if (current.type === "field") {
    let op = tokens.shift();
    let value = tokens.shift();
    if (!op || !value || op.type !== "=" || value.type !== "value") {
      throw new Error("parse error, invalid expression");
    }
    return {
      type: "condition",
      field: current.value,
      operator: "=",
      value: value.value
    };
  }
  throw new Error("parse error, invalid prefix");
}

function _parseInfix(left: AST, current: Token, tokens: Token[]): AST {
  if (current.type === "close") {
    return left;
  }
  let right = _parse(tokens, BINDING_POWERS[current.type]);
  if (current.type === "or") {
    return { type: "or", left, right };
  }
  if (current.type === "and") {
    return { type: "and", left, right };
  }
  throw new Error("parse error");
}

//------------------------------------------------------------------------------
// EVALUATOR (is that a word?)
//------------------------------------------------------------------------------

// examples:
// type = 'asset' OR type = 'income'
// id = 3 AND (type = 'asset' OR type = 'income')
export function evaluate(domain: string, record: Record): boolean {
  const expression = parse(tokenize(domain));
  return _evaluate(expression, record);
}

function _evaluate(expr: AST, record: Record): boolean {
  switch (expr.type) {
    case "empty":
      return true;
    case "condition":
      return record[expr.field] === expr.value;
    case "and":
      return _evaluate(expr.left, record) && _evaluate(expr.right, record);
    case "or":
      return _evaluate(expr.left, record) || _evaluate(expr.right, record);
    default:
      return false;
  }
}

export function makePredicate(domain: string): Predicate {
  const expression = parse(tokenize(domain));
  return record => _evaluate(expression, record);
}

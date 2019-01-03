//------------------------------------------------------------------------------
// MISC GENERIC TYPES
//------------------------------------------------------------------------------
type FieldValue = any;
export type Record = {
  id: string;
  [field: string]: FieldValue;
};
export type Predicate = (record: Record) => boolean;

//------------------------------------------------------------------------------
// DOMAIN SPECIFIC TYPES
//------------------------------------------------------------------------------

interface TokenOR {
  type: "or";
}
interface TokenAND {
  type: "and";
}
interface TokenEQ {
  type: "=";
}
interface TokenValue {
  type: "value";
  value: number | string;
}
interface TokenField {
  type: "field";
  value: string;
}
interface TokenOPENP {
  type: "open";
}
interface TokenCLOSEP {
  type: "close";
}

export type Token =
  | TokenOR
  | TokenAND
  | TokenEQ
  | TokenValue
  | TokenField
  | TokenOPENP
  | TokenCLOSEP;

type Value = string | number;
type FieldName = string;

interface Condition {
  type: "condition";
  field: FieldName;
  operator: "=";
  value: Value;
}
interface ExpressionAnd {
  type: "and";
  left: AST;
  right: AST;
}
interface ExpressionOR {
  type: "or";
  left: AST;
  right: AST;
}

interface Empty {
  type: "empty";
}

export type AST = ExpressionAnd | ExpressionOR | Condition | Empty;

import { maskSql, type MaskFn } from "./rules";

export type ColumnRule = {
  tableName: string;
  columnName: string;
  fn: string;
};

/** Turns declared PII rules into the UPDATE statements run against a clone. */
export function buildMaskingStatements(rules: ColumnRule[]): string[] {
  return rules.map(
    (r) =>
      `UPDATE "${r.tableName}" SET "${r.columnName}" = ${maskSql(
        r.fn as MaskFn,
        r.columnName,
      )};`,
  );
}

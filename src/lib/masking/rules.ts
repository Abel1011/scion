export type MaskFn =
  | "mask_email"
  | "mask_name"
  | "mask_card"
  | "mask_phone"
  | "mask_address"
  | "nullify";

export const MASK_LABEL: Record<MaskFn, string> = {
  mask_email: "Email",
  mask_name: "Name (pseudonym)",
  mask_card: "Card number",
  mask_phone: "Phone",
  mask_address: "Address",
  nullify: "Nullify",
};

/** Deterministic, FK-safe SQL expression that replaces a column's value. */
export function maskSql(fn: MaskFn, column: string): string {
  const c = `"${column}"`;
  switch (fn) {
    case "mask_email":
      return `regexp_replace(${c}, '(^.).*(@.*$)', '\\1••••@redacted.dev')`;
    case "mask_name":
      return `'User-' || substr(md5(${c}), 1, 6)`;
    case "mask_card":
      return `'•••• •••• •••• ' || right(regexp_replace(${c}, '\\D', '', 'g'), 4)`;
    case "mask_phone":
      return `'+•• ••• ••• ' || right(regexp_replace(${c}, '\\D', '', 'g'), 2)`;
    case "mask_address":
      return `'•••• ' || substr(md5(${c}), 1, 6) || ' (masked)'`;
    case "nullify":
      return `NULL`;
  }
}

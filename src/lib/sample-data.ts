/** Columns shown by the data explorer when no live clone is reachable (mock). */
export const SAMPLE_COLUMNS = ["id", "name", "email", "card"];

/** Masked rows shown by the data explorer in mock mode (PII already redacted). */
export const SAMPLE_MASKED_USERS = [
  { id: "a1f3…", name: "User-3a9c1d", email: "m••••@redacted.dev", card: "4••• •••• •••• 7781" },
  { id: "b8c2…", name: "User-7f21ab", email: "d••••@redacted.dev", card: "5••• •••• •••• 0934" },
  { id: "c4d9…", name: "User-c40e22", email: "a••••@redacted.dev", card: "4••• •••• •••• 2250" },
  { id: "d0e1…", name: "User-9b1f74", email: "l••••@redacted.dev", card: "3••• •••••• •4417" },
];

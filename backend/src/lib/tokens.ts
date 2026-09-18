/** Constant-time equality of two secret-valued strings. */

export function tokensMatch(provided: string, expected: string): boolean {
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    diff |= providedBytes[index] ^ expectedBytes[index];
  }
  return diff === 0;
}

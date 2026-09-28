import { timingSafeEqual } from 'node:crypto';

function secretEquals(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (valueBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(valueBuffer, expectedBuffer);
}

/** Checks secrets that are present on the server only; no credential is sent back to the client. */
export function authenticateDeveloper(username: string, password: string): boolean {
  const expectedUsername = process.env.DEVELOPER_PANEL_USERNAME ?? '';
  const expectedPassword = process.env.DEVELOPER_PANEL_PASSWORD ?? '';

  if (!expectedUsername || !expectedPassword) return false;
  return secretEquals(username.trim(), expectedUsername) && secretEquals(password, expectedPassword);
}

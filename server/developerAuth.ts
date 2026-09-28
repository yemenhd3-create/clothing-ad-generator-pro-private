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

  const trimmedUsername = username.trim();
  const usernameOk = !!expectedUsername && secretEquals(trimmedUsername, expectedUsername);
  const passwordOk = !!expectedPassword && secretEquals(password, expectedPassword);

  // TEMP DIAGNOSTIC (no secret values are logged, only presence/lengths):
  console.warn('[DeveloperAuth] attempt', {
    envUsernameSet: !!expectedUsername,
    envUsernameLen: expectedUsername.length,
    envPasswordSet: !!expectedPassword,
    envPasswordLen: expectedPassword.length,
    inputUsernameLen: trimmedUsername.length,
    inputPasswordLen: password.length,
    usernameOk,
    passwordOk,
  });

  if (!expectedUsername || !expectedPassword) return false;
  return usernameOk && passwordOk;
}

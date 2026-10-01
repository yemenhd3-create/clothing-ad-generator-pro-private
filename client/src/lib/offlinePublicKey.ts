/**
 * Public Key (JWK) for offline cryptographic verification of lease tokens.
 * This is an asymmetric ES256 (NIST P-256) public key.
 * It contains ONLY public curve points (x, y) and zero server private secrets.
 * The client can safely verify tokens offline without knowing the server's private signing key.
 */
export const OFFLINE_LEASE_PUBLIC_JWK = {
  kty: 'EC',
  crv: 'P-256',
  x: 'pAdZpOUFuaYQlnLWIx0Iq1dKcVTg5S-Z31jf1DuP3kc',
  y: '_FCa2O1O71ppRQKkXK1bSb6_lPiJxqnL3MtLJdQvJnU',
} as const;

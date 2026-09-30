/**
 * Public Key (JWK) for offline cryptographic verification of lease tokens.
 * This is an asymmetric ES256 (NIST P-256) public key.
 * It contains ONLY public curve points (x, y) and zero server private secrets.
 * The client can safely verify tokens offline without knowing the server's private signing key.
 */
export const OFFLINE_LEASE_PUBLIC_JWK = {
  kty: 'EC',
  crv: 'P-256',
  x: '4Ghqcut1XtiByC5dspobhfhePD1GUkoANx22bvBHpNg',
  y: 'zWb5YevfwL1u1r_Qw2RX4br1Oa453kZ5QwFK87uAltw',
} as const;

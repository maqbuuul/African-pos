import { hash, verify } from '@node-rs/argon2'

// argon2id, OWASP-recommended baseline parameters (19 MiB memory, 2 iterations,
// 1 degree of parallelism) — used for both staff PINs and owner/admin passwords.
// Centralized here so every credential in the system (current and future) hashes
// the same way instead of each call site picking its own parameters.
const HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export const hashSecret = (secret: string): Promise<string> => hash(secret, HASH_OPTIONS)

export const verifySecret = (secretHash: string, secret: string): Promise<boolean> =>
  verify(secretHash, secret)

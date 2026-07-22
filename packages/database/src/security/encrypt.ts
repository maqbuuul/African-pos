import crypto from 'node:crypto'

// AES-256-GCM credential encryption for integration_connections.credentials_encrypted.
// The encryption key must be exactly 64 hex characters (32 bytes) set via the
// CREDENTIALS_ENCRYPTION_KEY environment variable. Never fallback to a default —
// a startup failure is far preferable to silently storing credentials under a
// predictable key (BUILD_WORKFLOW.md §6: credentials must be encrypted at rest).
//
// The output is a JSON blob: { iv, tag, data } all hex-encoded. Safe to store
// in any text/varchar column. The IV is randomly generated on every encrypt
// call — never reuse IVs with GCM.
//
// NEVER log or return the output of encryptCredentials in API responses.

const ALGORITHM = 'aes-256-gcm' as const
const IV_BYTES = 12 // 96-bit IV, recommended for GCM

function getKey(): Buffer {
  const hex = process.env['CREDENTIALS_ENCRYPTION_KEY']
  if (!hex || hex.length !== 64) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY must be set to exactly 64 hex characters (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  return Buffer.from(hex, 'hex')
}

interface EncryptedBlob {
  iv: string
  tag: string
  data: string
}

export function encryptCredentials(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  } satisfies EncryptedBlob)
}

export function decryptCredentials(encryptedJson: string): string {
  const key = getKey()
  const { iv, tag, data } = JSON.parse(encryptedJson) as EncryptedBlob
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

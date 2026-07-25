import { beforeEach, describe, expect, it } from 'vitest'
import { decryptCredentials, encryptCredentials } from './encrypt.js'

const VALID_KEY = 'a'.repeat(64) // 32 bytes hex

describe('encryptCredentials / decryptCredentials', () => {
  beforeEach(() => {
    process.env['CREDENTIALS_ENCRYPTION_KEY'] = VALID_KEY
  })

  it('round-trips plaintext through encrypt then decrypt', () => {
    const plaintext = JSON.stringify({ secretKey: 'sk_test_abc123', webhookSecretHash: 'xyz' })
    const encrypted = encryptCredentials(plaintext)
    expect(decryptCredentials(encrypted)).toBe(plaintext)
  })

  it('produces a different ciphertext on every call for the same plaintext (random IV)', () => {
    const plaintext = 'same-secret'
    const first = encryptCredentials(plaintext)
    const second = encryptCredentials(plaintext)
    expect(first).not.toBe(second)
    // but both still decrypt to the same value
    expect(decryptCredentials(first)).toBe(plaintext)
    expect(decryptCredentials(second)).toBe(plaintext)
  })

  it('stores iv/tag/data as hex in the serialized blob', () => {
    const encrypted = encryptCredentials('hello')
    const blob = JSON.parse(encrypted) as { iv: string; tag: string; data: string }
    expect(blob.iv).toMatch(/^[0-9a-f]+$/)
    expect(blob.tag).toMatch(/^[0-9a-f]+$/)
    expect(blob.data).toMatch(/^[0-9a-f]+$/)
  })

  it('throws when decrypting with a different key than it was encrypted with', () => {
    const encrypted = encryptCredentials('top-secret-value')
    process.env['CREDENTIALS_ENCRYPTION_KEY'] = 'b'.repeat(64)
    expect(() => decryptCredentials(encrypted)).toThrow()
  })

  it('throws when the ciphertext has been tampered with (GCM auth tag rejects it)', () => {
    const encrypted = encryptCredentials('do-not-tamper')
    const blob = JSON.parse(encrypted) as { iv: string; tag: string; data: string }
    // Flip a byte in the ciphertext data.
    const tamperedByte = (parseInt(blob.data.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0')
    blob.data = tamperedByte + blob.data.slice(2)
    expect(() => decryptCredentials(JSON.stringify(blob))).toThrow()
  })

  it('throws when the auth tag has been tampered with', () => {
    const encrypted = encryptCredentials('do-not-tamper')
    const blob = JSON.parse(encrypted) as { iv: string; tag: string; data: string }
    const tamperedByte = (parseInt(blob.tag.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0')
    blob.tag = tamperedByte + blob.tag.slice(2)
    expect(() => decryptCredentials(JSON.stringify(blob))).toThrow()
  })

  it('throws if CREDENTIALS_ENCRYPTION_KEY is unset', () => {
    delete process.env['CREDENTIALS_ENCRYPTION_KEY']
    expect(() => encryptCredentials('anything')).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
  })

  it('throws if CREDENTIALS_ENCRYPTION_KEY is the wrong length', () => {
    process.env['CREDENTIALS_ENCRYPTION_KEY'] = 'tooshort'
    expect(() => encryptCredentials('anything')).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
  })
})

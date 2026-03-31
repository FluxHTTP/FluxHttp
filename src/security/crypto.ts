// SECURITY: Cryptographic utilities for token encryption and secure random generation

// Environment detection
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

/**
 * Security-focused cryptographic utilities
 * Provides secure random byte generation and token encryption/decryption
 */
export class SecurityCrypto {
  private static encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  private static decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  /**
   * BUG-002 FIX: Convert Uint8Array to string using TextDecoder when possible
   * String.fromCharCode.apply fails for arrays larger than ~65,536 elements
   */
  private static uint8ArrayToString(bytes: Uint8Array): string {
    if (this.decoder) {
      return this.decoder.decode(bytes);
    }
    const CHUNK_SIZE = 8192; // Safe chunk size
    let result = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      result += String.fromCharCode.apply(null, Array.from(chunk) as any);
    }
    return result;
  }

  /**
   * Generate cryptographically secure random bytes
   * Falls back to less secure Math.random if crypto APIs unavailable
   */
  static generateSecureBytes(length: number): Uint8Array {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(new Uint8Array(length));
    }
    if (isNode && typeof require !== 'undefined') {
      try {
        // Define proper interface for Node.js crypto module
        interface NodeCrypto {
          randomBytes(size: number): Buffer;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require('crypto') as NodeCrypto;
        const buffer = nodeCrypto.randomBytes(length);
        return new Uint8Array(buffer);
      } catch {
        // Fall through to error
      }
    }
    // BUG-004 FIX: Fail securely instead of using Math.random() for cryptographic operations
    throw new Error('Cryptographically secure random number generator is not available. Please use a modern browser or Node.js environment with crypto support.');
  }

  /**
   * SECURITY: Improved token encryption using AES-GCM
   */
  static async encryptToken(token: string, key: Uint8Array): Promise<string> {
    if (!this.encoder) {
      throw new Error('TextEncoder not available for encryption');
    }

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      return await this.encryptWithAESGCM(token, key);
    }

    throw new Error('Cryptographically secure encryption is not available in this environment.');
  }

  /**
   * SECURITY: Decrypt token with automatic format detection
   */
  static async decryptToken(encryptedToken: string, key: Uint8Array): Promise<string> {
    if (!this.decoder) {
      throw new Error('TextDecoder not available for decryption');
    }

    if (!encryptedToken.startsWith('aes:')) {
      throw new Error('Only AES-GCM encrypted tokens are supported');
    }

    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        return await this.decryptFromAESGCM(encryptedToken.slice(4), key);
      }
      throw new Error('Cryptographically secure decryption is not available in this environment.');
    } catch {
      throw new Error('Token decryption failed');
    }
  }

  /**
   * SECURITY: AES-GCM encryption using WebCrypto API
   */
  private static async encryptWithAESGCM(token: string, key: Uint8Array): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const tokenBytes = this.encoder!.encode(token);
    
    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.slice(0, 32), // Use first 32 bytes for AES-256
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      tokenBytes
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return 'aes:' + btoa(this.uint8ArrayToString(combined));
  }

  /**
   * SECURITY: AES-GCM decryption using WebCrypto API
   */
  private static async decryptFromAESGCM(encryptedData: string, key: Uint8Array): Promise<string> {
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.slice(0, 32),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    return this.decoder!.decode(decrypted);
  }
}

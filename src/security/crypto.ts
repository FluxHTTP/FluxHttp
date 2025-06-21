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
        // Fallback to Math.random (less secure)
      }
    }
    // Fallback: less secure but better than nothing
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  /**
   * Simple XOR encryption for in-memory token protection
   * Not suitable for persistent storage, but good for runtime protection
   */
  static encryptToken(token: string, key: Uint8Array): string {
    if (!this.encoder) {
      return token; // Fallback: return plain token if no encoder
    }

    const tokenBytes = this.encoder.encode(token);
    const encrypted = new Uint8Array(tokenBytes.length);

    for (let i = 0; i < tokenBytes.length; i++) {
      encrypted[i] = tokenBytes[i]! ^ key[i % key.length]!;
    }

    return btoa(String.fromCharCode.apply(null, Array.from(encrypted)));
  }

  /**
   * Decrypt XOR-encrypted token
   */
  static decryptToken(encryptedToken: string, key: Uint8Array): string {
    if (!this.decoder) {
      return encryptedToken; // Fallback: return as-is if no decoder
    }

    try {
      const encryptedBytes = new Uint8Array(
        atob(encryptedToken)
          .split('')
          .map((char) => char.charCodeAt(0))
      );

      const decrypted = new Uint8Array(encryptedBytes.length);
      for (let i = 0; i < encryptedBytes.length; i++) {
        decrypted[i] = encryptedBytes[i]! ^ key[i % key.length]!;
      }

      return this.decoder.decode(decrypted);
    } catch {
      return encryptedToken; // Fallback on error
    }
  }
}

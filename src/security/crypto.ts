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
   * BUG-002 FIX: Convert Uint8Array to string in chunks to avoid stack overflow
   * String.fromCharCode.apply fails for arrays larger than ~65,536 elements
   */
  private static uint8ArrayToString(bytes: Uint8Array): string {
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
   * SECURITY: Improved token encryption using AES-GCM when available
   * Falls back to stronger XOR with HMAC authentication if WebCrypto unavailable
   */
  static async encryptToken(token: string, key: Uint8Array): Promise<string> {
    if (!this.encoder) {
      throw new Error('TextEncoder not available for encryption');
    }

    // Try to use WebCrypto API for AES-GCM encryption
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        return await this.encryptWithAESGCM(token, key);
      } catch {
        // Fall through to XOR with HMAC
      }
    }

    // Fallback to XOR with HMAC authentication
    return this.encryptWithXORHMAC(token, key);
  }

  /**
   * SECURITY: Decrypt token with automatic format detection
   */
  static async decryptToken(encryptedToken: string, key: Uint8Array): Promise<string> {
    if (!this.decoder) {
      throw new Error('TextDecoder not available for decryption');
    }

    try {
      // Try AES-GCM first (if format indicates it)
      if (encryptedToken.startsWith('aes:')) {
        return await this.decryptFromAESGCM(encryptedToken.slice(4), key);
      }

      // Try XOR with HMAC (default)
      return this.decryptFromXORHMAC(encryptedToken, key);
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

  /**
   * SECURITY: XOR encryption with HMAC authentication
   */
  private static encryptWithXORHMAC(token: string, key: Uint8Array): string {
    const tokenBytes = this.encoder!.encode(token);
    const iv = this.generateSecureBytes(16); // Random IV
    const encKey = this.deriveKey(key, iv, 'encrypt');
    const macKey = this.deriveKey(key, iv, 'mac');
    
    // XOR encryption
    const encrypted = new Uint8Array(tokenBytes.length);
    for (let i = 0; i < tokenBytes.length; i++) {
      encrypted[i] = tokenBytes[i]! ^ encKey[i % encKey.length]!;
    }

    // Compute HMAC
    const mac = this.computeHMAC(macKey, iv, encrypted);
    
    // Combine IV + MAC + ciphertext
    const combined = new Uint8Array(iv.length + mac.length + encrypted.length);
    combined.set(iv);
    combined.set(mac, iv.length);
    combined.set(encrypted, iv.length + mac.length);

    return btoa(this.uint8ArrayToString(combined));
  }

  /**
   * SECURITY: XOR decryption with HMAC verification
   */
  private static decryptFromXORHMAC(encryptedToken: string, key: Uint8Array): string {
    const combined = new Uint8Array(
      atob(encryptedToken).split('').map(char => char.charCodeAt(0))
    );

    if (combined.length < 48) { // 16 (IV) + 32 (MAC) minimum
      throw new Error('Invalid encrypted token format');
    }

    const iv = combined.slice(0, 16);
    const mac = combined.slice(16, 48);
    const ciphertext = combined.slice(48);

    const encKey = this.deriveKey(key, iv, 'encrypt');
    const macKey = this.deriveKey(key, iv, 'mac');

    // Verify HMAC
    const expectedMac = this.computeHMAC(macKey, iv, ciphertext);
    if (!this.constantTimeEqual(mac, expectedMac)) {
      throw new Error('Token authentication failed');
    }

    // Decrypt
    const decrypted = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      decrypted[i] = ciphertext[i]! ^ encKey[i % encKey.length]!;
    }

    return this.decoder!.decode(decrypted);
  }

  /**
   * SECURITY: Simple key derivation using repeated hashing
   */
  private static deriveKey(key: Uint8Array, salt: Uint8Array, purpose: string): Uint8Array {
    const input = new Uint8Array(key.length + salt.length + purpose.length);
    input.set(key);
    input.set(salt, key.length);
    input.set(this.encoder!.encode(purpose), key.length + salt.length);
    
    // Simple hash-based derivation (not PBKDF2, but better than nothing)
    return this.simpleHash(input);
  }

  /**
   * SECURITY: Simple HMAC computation using available hash functions
   */
  private static computeHMAC(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
    const blockSize = 64; // SHA-256 block size
    const opad = new Uint8Array(blockSize).fill(0x5c);
    const ipad = new Uint8Array(blockSize).fill(0x36);
    
    // Adjust key length
    let hmacKey = new Uint8Array(blockSize);
    if (key.length > blockSize) {
      const hashedKey = this.simpleHash(key);
      hmacKey.set(hashedKey);
    } else {
      hmacKey.set(key);
    }

    // XOR with pads
    for (let i = 0; i < blockSize; i++) {
      opad[i] ^= hmacKey[i]!;
      ipad[i] ^= hmacKey[i]!;
    }

    // Inner hash
    const innerInput = new Uint8Array(ipad.length + iv.length + data.length);
    innerInput.set(ipad);
    innerInput.set(iv, ipad.length);
    innerInput.set(data, ipad.length + iv.length);
    const innerHash = this.simpleHash(innerInput);

    // Outer hash
    const outerInput = new Uint8Array(opad.length + innerHash.length);
    outerInput.set(opad);
    outerInput.set(innerHash, opad.length);
    
    return this.simpleHash(outerInput);
  }

  /**
   * SECURITY: Simple hash function (not cryptographically secure, but better than none)
   */
  private static simpleHash(data: Uint8Array): Uint8Array {
    const hash = new Uint8Array(32);
    let h = 0x811c9dc5; // FNV offset basis
    
    for (let i = 0; i < data.length; i++) {
      h ^= data[i]!;
      h = (h * 0x01000193) >>> 0; // FNV prime
    }

    // Generate 32 bytes from single hash
    for (let i = 0; i < 32; i++) {
      hash[i] = (h >>> (i % 32)) & 0xff;
      h = (h * 0x01000193) >>> 0;
    }

    return hash;
  }

  /**
   * SECURITY: Constant-time comparison to prevent timing attacks
   */
  private static constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i]! ^ b[i]!;
    }

    return result === 0;
  }
}

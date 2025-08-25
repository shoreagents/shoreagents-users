import crypto from 'crypto';

/**
 * Chat Message Encryption Service
 * Provides encryption/decryption for team chat messages
 * Uses AES-256-GCM for message encryption
 */
export class ChatEncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits

  constructor() {
    // Ensure encryption key is available
    if (!process.env.CHAT_ENCRYPTION_KEY) {
      throw new Error('CHAT_ENCRYPTION_KEY environment variable is required');
    }
  }

  /**
   * Encrypt a message
   * @param content - Plain text message content
   * @returns Encrypted message with IV and auth tag
   */
  encryptMessage(content: string): {
    encryptedContent: string;
    iv: string;
    authTag: string;
    messageHash: string;
  } {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher with IV
      const key = Buffer.from(process.env.CHAT_ENCRYPTION_KEY!, 'hex');
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Encrypt the message
      let encrypted = cipher.update(content, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Generate message hash for integrity
      const messageHash = this.generateMessageHash(content);
      
      return {
        encryptedContent: encrypted,
        iv: iv.toString('hex'),
        authTag: '', // Not used in CBC mode
        messageHash
      };
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypt a message
   * @param encryptedContent - Encrypted message content
   * @param iv - Initialization vector
   * @param authTag - Authentication tag
   * @returns Decrypted message content
   */
  decryptMessage(
    encryptedContent: string,
    iv: string,
    authTag: string
  ): string {
    try {
      // Create decipher with IV
      const key = Buffer.from(process.env.CHAT_ENCRYPTION_KEY!, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
      
      // Decrypt the message
      let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * Generate hash for message integrity verification
   * @param content - Message content
   * @returns SHA-256 hash
   */
  private generateMessageHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Verify message integrity
   * @param content - Decrypted message content
   * @param expectedHash - Expected message hash
   * @returns True if hash matches
   */
  verifyMessageIntegrity(content: string, expectedHash: string): boolean {
    const actualHash = this.generateMessageHash(content);
    return actualHash === expectedHash;
  }

  /**
   * Generate a new encryption key
   * @returns New encryption key as hex string
   */
  static generateNewKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Message encryption utilities
 */
export const chatEncryption = new ChatEncryptionService();

/**
 * Types for encrypted messages
 */
export interface EncryptedMessage {
  encryptedContent: string;
  iv: string;
  authTag: string;
  messageHash: string;
}

export interface DecryptedMessage {
  content: string;
  isValid: boolean;
}

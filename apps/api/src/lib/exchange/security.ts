import crypto from 'crypto';
import { exchangeLogger } from './logger';

/**
 * Security utilities for Exchange integration
 * Node.js 24 optimized with enhanced security features
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

interface SecurityOptions {
  maxEmailProcessingBatch?: number;
  tokenEncryptionKey?: string;
  allowedOrigins?: string[];
  rateLimits?: {
    oauth?: RateLimitConfig;
    emailProcessing?: RateLimitConfig;
    graphApi?: RateLimitConfig;
  };
}

class ExchangeSecurity {
  private encryptionKey: Buffer;
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(options: SecurityOptions = {}) {
    // Use environment variable or generate a secure key
    const keyString = options.tokenEncryptionKey || process.env.EXCHANGE_ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('EXCHANGE_ENCRYPTION_KEY environment variable is required');
    }
    
    this.encryptionKey = crypto.scryptSync(keyString, 'exchange-salt', 32);
  }

  /**
   * Encrypt sensitive token data using Node.js 24 enhanced crypto
   */
  encryptToken(token: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      exchangeLogger.error('Token encryption failed', {
        error: error as Error,
        operation: 'encrypt_token',
      });
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt sensitive token data
   */
  decryptToken(encryptedToken: string): string {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
      
      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted token format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      exchangeLogger.error('Token decryption failed', {
        error: error as Error,
        operation: 'decrypt_token',
      });
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Validate OAuth state parameter to prevent CSRF attacks
   */
  generateSecureState(userId: string): string {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = `${userId}:${timestamp}:${nonce}`;
    
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  /**
   * Validate OAuth state parameter
   */
  validateState(state: string, userId: string, maxAge: number = 600000): boolean {
    try {
      const decoded = Buffer.from(state, 'base64').toString();
      const [receivedUserId, timestamp, nonce, signature] = decoded.split(':');
      
      if (!receivedUserId || !timestamp || !nonce || !signature) {
        return false;
      }

      // Validate user ID
      if (receivedUserId !== userId) {
        exchangeLogger.warn('OAuth state validation failed: user ID mismatch', {
          expectedUserId: userId,
          receivedUserId,
          operation: 'validate_state',
        });
        return false;
      }

      // Validate timestamp (prevent replay attacks)
      const stateAge = Date.now() - parseInt(timestamp);
      if (stateAge > maxAge) {
        exchangeLogger.warn('OAuth state validation failed: expired state', {
          stateAge,
          maxAge,
          operation: 'validate_state',
        });
        return false;
      }

      // Validate signature
      const payload = `${receivedUserId}:${timestamp}:${nonce}`;
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      exchangeLogger.error('OAuth state validation error', {
        error: error as Error,
        operation: 'validate_state',
      });
      return false;
    }
  }

  /**
   * Rate limiting implementation
   */
  checkRateLimit(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const entry = this.rateLimitStore.get(key);

    if (!entry || now >= entry.resetTime) {
      // Reset window
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }

    if (entry.count >= config.maxRequests) {
      exchangeLogger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        limit: config.maxRequests,
        operation: 'rate_limit_check',
      });
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Input validation for Exchange connection data
   */
  validateConnectionInput(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate tenant ID (UUID format)
    if (!data.tenantId || typeof data.tenantId !== 'string') {
      errors.push('Tenant ID is required');
    } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.tenantId)) {
      errors.push('Invalid tenant ID format');
    }

    // Validate client ID (UUID format)
    if (!data.clientId || typeof data.clientId !== 'string') {
      errors.push('Client ID is required');
    } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.clientId)) {
      errors.push('Invalid client ID format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize email content to prevent XSS and injection attacks
   */
  sanitizeEmailContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Remove potentially dangerous HTML tags and attributes
    return content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:text\/html/gi, '');
  }

  /**
   * Validate email address format
   */
  isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string' || email.length === 0) {
      return false;
    }

    // Basic format check: must contain @ and have parts before and after
    if (!email.includes('@')) {
      return false;
    }

    const parts = email.split('@');
    if (parts.length !== 2) {
      return false;
    }

    const [localPart, domainPart] = parts;
    if (!localPart || !domainPart) {
      return false;
    }

    // Check for consecutive dots
    if (email.includes('..')) {
      return false;
    }

    // Check domain starts/ends with dot
    if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Clean up rate limit store (should be called periodically)
   */
  cleanupRateLimitStore(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now >= entry.resetTime) {
        this.rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      exchangeLogger.debug('Rate limit store cleanup completed', {
        cleanedEntries: cleaned,
        remainingEntries: this.rateLimitStore.size,
        operation: 'cleanup_rate_limit_store',
      });
    }
  }

  /**
   * Generate secure random string for PKCE code verifier
   */
  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Verify webhook signature (if implementing webhook support)
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const expectedSignature = 'sha256=' + hmac.digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      exchangeLogger.error('Webhook signature verification failed', {
        error: error as Error,
        operation: 'verify_webhook_signature',
      });
      return false;
    }
  }
}

// Default security configuration
const defaultConfig: SecurityOptions = {
  maxEmailProcessingBatch: 50,
  rateLimits: {
    oauth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 OAuth attempts per 15 minutes
    },
    emailProcessing: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 email processing requests per minute
    },
    graphApi: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 Graph API calls per minute
    },
  },
};

// Singleton instance
export const exchangeSecurity = new ExchangeSecurity(defaultConfig);

// Cleanup rate limit store every 10 minutes (only in production)
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupInterval() {
  if (cleanupInterval) {
    return; // Already started
  }
  
  cleanupInterval = setInterval(() => {
    exchangeSecurity.cleanupRateLimitStore();
  }, 10 * 60 * 1000);
}

export function stopCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup in production (not in test environment)
if (process.env.NODE_ENV !== 'test') {
  startCleanupInterval();
}

export { ExchangeSecurity, type SecurityOptions, type RateLimitConfig };
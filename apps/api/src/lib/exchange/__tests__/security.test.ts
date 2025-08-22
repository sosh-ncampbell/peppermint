import { describe, it, expect, beforeEach } from '@jest/globals';
import { exchangeSecurity } from '../security';

describe('ExchangeSecurity', () => {
  describe('Token Encryption', () => {
    it('should encrypt and decrypt tokens correctly', () => {
      const originalToken = 'test-access-token-123';
      
      const encrypted = exchangeSecurity.encryptToken(originalToken);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(originalToken);
      expect(encrypted).toContain(':'); // Should have IV:authTag:encrypted format
      
      const decrypted = exchangeSecurity.decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('should generate different encrypted values for the same token', () => {
      const token = 'same-token-123';
      
      const encrypted1 = exchangeSecurity.encryptToken(token);
      const encrypted2 = exchangeSecurity.encryptToken(token);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same value
      expect(exchangeSecurity.decryptToken(encrypted1)).toBe(token);
      expect(exchangeSecurity.decryptToken(encrypted2)).toBe(token);
    });

    it('should throw error for invalid encrypted token format', () => {
      const invalidEncrypted = 'invalid-format';
      
      expect(() => {
        exchangeSecurity.decryptToken(invalidEncrypted);
      }).toThrow('Failed to decrypt token');
    });
  });

  describe('OAuth State Management', () => {
    it('should generate and validate secure state', () => {
      const userId = 'user-123';
      
      const state = exchangeSecurity.generateSecureState(userId);
      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      
      const isValid = exchangeSecurity.validateState(state, userId);
      expect(isValid).toBe(true);
    });

    it('should reject state with wrong user ID', () => {
      const userId = 'user-123';
      const wrongUserId = 'user-456';
      
      const state = exchangeSecurity.generateSecureState(userId);
      const isValid = exchangeSecurity.validateState(state, wrongUserId);
      
      expect(isValid).toBe(false);
    });

    it('should reject tampered state', () => {
      const userId = 'user-123';
      
      const state = exchangeSecurity.generateSecureState(userId);
      const tamperedState = state.replace(/.$/, 'X'); // Change last character
      
      const isValid = exchangeSecurity.validateState(tamperedState, userId);
      expect(isValid).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should validate valid connection input', () => {
      const validInput = {
        tenantId: '12345678-1234-1234-1234-123456789abc',
        clientId: '87654321-4321-4321-4321-cba987654321',
      };
      
      const result = exchangeSecurity.validateConnectionInput(validInput);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid tenant ID format', () => {
      const invalidInput = {
        tenantId: 'invalid-uuid',
        clientId: '87654321-4321-4321-4321-cba987654321',
      };
      
      const result = exchangeSecurity.validateConnectionInput(invalidInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid tenant ID format');
    });

    it('should reject missing required fields', () => {
      const incompleteInput = {
        tenantId: '12345678-1234-1234-1234-123456789abc',
        // missing clientId
      };
      
      const result = exchangeSecurity.validateConnectionInput(incompleteInput);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Client ID is required');
    });
  });

  describe('Email Content Sanitization', () => {
    it('should remove dangerous script tags', () => {
      const dangerousContent = '<p>Hello</p><script>alert("hack")</script><p>World</p>';
      
      const sanitized = exchangeSecurity.sanitizeEmailContent(dangerousContent);
      
      expect(sanitized).toBe('<p>Hello</p><p>World</p>');
      expect(sanitized).not.toContain('<script');
    });

    it('should remove iframe tags', () => {
      const dangerousContent = '<div>Content</div><iframe src="http://evil.com"></iframe>';
      
      const sanitized = exchangeSecurity.sanitizeEmailContent(dangerousContent);
      
      expect(sanitized).toBe('<div>Content</div>');
      expect(sanitized).not.toContain('<iframe');
    });

    it('should remove javascript: and vbscript: URLs', () => {
      const dangerousContent = '<a href="javascript:alert(1)">Click me</a>';
      
      const sanitized = exchangeSecurity.sanitizeEmailContent(dangerousContent);
      
      expect(sanitized).not.toContain('javascript:');
    });

    it('should handle empty or null content', () => {
      expect(exchangeSecurity.sanitizeEmailContent('')).toBe('');
      expect(exchangeSecurity.sanitizeEmailContent(null as any)).toBe('');
      expect(exchangeSecurity.sanitizeEmailContent(undefined as any)).toBe('');
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_123@subdomain.example.org',
      ];
      
      validEmails.forEach(email => {
        expect(exchangeSecurity.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@.example.com',
        '',
        null,
        undefined,
      ];
      
      invalidEmails.forEach(email => {
        expect(exchangeSecurity.isValidEmail(email as any)).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Clean up rate limit store before each test
      exchangeSecurity.cleanupRateLimitStore();
    });

    it('should allow requests within limit', () => {
      const key = 'test-user-1';
      const config = { windowMs: 60000, maxRequests: 3 };
      
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(true);
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(true);
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      const key = 'test-user-2';
      const config = { windowMs: 60000, maxRequests: 2 };
      
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(true);
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(true);
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(false); // Should be blocked
    });

    it('should reset limit after window expires', () => {
      const key = 'test-user-3';
      const config = { windowMs: 100, maxRequests: 1 }; // Very short window
      
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(true);
      expect(exchangeSecurity.checkRateLimit(key, config)).toBe(false);
      
      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          expect(exchangeSecurity.checkRateLimit(key, config)).toBe(true);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('PKCE Code Generation', () => {
    it('should generate valid code verifier', () => {
      const codeVerifier = exchangeSecurity.generateCodeVerifier();
      
      expect(codeVerifier).toBeDefined();
      expect(typeof codeVerifier).toBe('string');
      expect(codeVerifier.length).toBeGreaterThan(40); // Should be base64url encoded
    });

    it('should generate different verifiers each time', () => {
      const verifier1 = exchangeSecurity.generateCodeVerifier();
      const verifier2 = exchangeSecurity.generateCodeVerifier();
      
      expect(verifier1).not.toBe(verifier2);
    });

    it('should generate valid code challenge from verifier', () => {
      const codeVerifier = exchangeSecurity.generateCodeVerifier();
      const codeChallenge = exchangeSecurity.generateCodeChallenge(codeVerifier);
      
      expect(codeChallenge).toBeDefined();
      expect(typeof codeChallenge).toBe('string');
      expect(codeChallenge).not.toBe(codeVerifier);
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'webhook-secret-123';
      
      // This would normally be generated by the webhook sender
      const crypto = require('crypto');
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      const isValid = exchangeSecurity.verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'webhook-secret-123';
      const invalidSignature = 'sha256=invalid-signature';
      
      const isValid = exchangeSecurity.verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });
  });
});
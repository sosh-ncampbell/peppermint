import { randomBytes, createHash } from 'crypto';

/**
 * Generate a cryptographically secure random string for OAuth state parameter
 */
export function generateState(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code verifier and challenge
 * @returns Object containing code verifier and challenge
 */
export function generatePKCECodes(): {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
} {
  // Generate code verifier (43-128 characters, URL-safe)
  const codeVerifier = randomBytes(32).toString('base64url');
  
  // Generate code challenge using SHA256
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

/**
 * Generate a secure random string for session identifiers
 */
export function generateSessionId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Validate OAuth state parameter format
 */
export function isValidState(state: string): boolean {
  // Check if state is a valid base64url string of appropriate length
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return typeof state === 'string' && 
         state.length >= 32 && 
         state.length <= 128 && 
         base64urlRegex.test(state);
}

/**
 * Generate a secure tenant-specific identifier
 */
export function generateTenantConnectionId(tenantId: string, userId: string): string {
  const combined = `${tenantId}:${userId}:${Date.now()}`;
  return createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Mask sensitive data for logging
 */
export function maskToken(token: string): string {
  if (token.length <= 8) return '***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

/**
 * Generate a secure API key for webhook validation
 */
export function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize email content for storage
 */
export function sanitizeEmailContent(content: string): string {
  // Remove potentially harmful content while preserving structure
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Extract plain text from HTML email content
 */
export function extractPlainText(htmlContent: string): string {
  return htmlContent
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OAuthService } from '../OAuthService';
import type { 
  ExchangeConnectionData, 
  ExchangeTokenData,
  GraphTokenResponse 
} from '../../../types/exchange';

// Mock environment variables
process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';
process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:3000/api/v1/exchange/oauth/callback';
process.env.API_BASE_URL = 'http://localhost:3000';

describe('OAuthService', () => {
  let service: OAuthService;
  let mockConnection: ExchangeConnectionData;
  let mockToken: ExchangeTokenData;

  // Manual mock state
  let mockPrismaState: any = {};
  let mockFetchState: any = {};

  // Create manual mocks
  const mockPrisma = {
    exchangeOAuthSession: {
      create: async () => mockPrismaState.sessionCreateResult,
      findUnique: async () => mockPrismaState.sessionFindResult,
      delete: async () => mockPrismaState.sessionDeleteResult,
      deleteMany: async () => mockPrismaState.sessionDeleteManyResult,
    },
    exchangeConnection: {
      findFirst: async () => mockPrismaState.connectionFindFirstResult,
      findUnique: async () => mockPrismaState.connectionFindUniqueResult,
    },
    exchangeToken: {
      create: async () => mockPrismaState.tokenCreateResult,
      deleteMany: async () => mockPrismaState.tokenDeleteManyResult,
    },
  };

  // Mock fetch
  const originalFetch = global.fetch;
  const mockFetch = async () => mockFetchState.response;

  beforeEach(() => {
    // Setup global fetch mock
    global.fetch = mockFetch as any;
    
    // Create service instance
    service = new OAuthService(mockPrisma as any);
    
    mockConnection = {
      id: 'conn_123',
      userId: 'user_123',
      tenantId: 'tenant_123',
      clientId: 'client_123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockToken = {
      id: 'token_123',
      connectionId: 'conn_123',
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      scope: 'https://graph.microsoft.com/Mail.Read offline_access',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Reset mock state
    mockPrismaState = {};
    mockFetchState = {};
  });

  afterEach(() => {
    // Restore global fetch
    global.fetch = originalFetch;
  });

  describe('generateAuthUrl', () => {
    it('should generate OAuth authorization URL with PKCE', async () => {
      mockPrismaState.sessionCreateResult = {
        id: 'session_123',
        state: 'test-state-123',
        codeVerifier: 'test-code-verifier',
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 600000),
      };

      const result = await service.generateAuthUrl('user_123', 'tenant_123', 'client_123');

      expect(result).toEqual(
        expect.objectContaining({
          authUrl: expect.stringContaining('https://login.microsoftonline.com/tenant_123/oauth2/v2.0/authorize'),
          state: expect.any(String),
          codeVerifier: expect.any(String),
        })
      );

      // Verify URL contains required parameters
      const url = new URL(result.authUrl);
      expect(url.searchParams.get('client_id')).toBe('client_123');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('https://graph.microsoft.com/Mail.Read offline_access');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('should handle database errors during session creation', async () => {
      const originalCreate = mockPrisma.exchangeOAuthSession.create;
      mockPrisma.exchangeOAuthSession.create = async () => {
        throw new Error('Database error');
      };

      await expect(service.generateAuthUrl('user_123', 'tenant_123', 'client_123'))
        .rejects
        .toThrow('Failed to generate authorization URL');

      // Restore
      mockPrisma.exchangeOAuthSession.create = originalCreate;
    });
  });

  describe('handleCallback', () => {
    it('should successfully handle OAuth callback', async () => {
      // Mock OAuth session
      mockPrismaState.sessionFindResult = {
        id: 'session_123',
        state: 'test-state-123',
        codeVerifier: 'test-code-verifier',
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
        user: {
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      // Mock connection
      mockPrismaState.connectionFindFirstResult = mockConnection;

      // Mock token exchange response
      const tokenResponse: GraphTokenResponse = {
        access_token: 'new_access_token_123',
        refresh_token: 'new_refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://graph.microsoft.com/Mail.Read offline_access',
      };

      mockFetchState.response = {
        ok: true,
        json: async () => tokenResponse,
      };

      // Mock token creation
      mockPrismaState.tokenCreateResult = {
        ...mockToken,
        accessToken: 'new_access_token_123',
        refreshToken: 'new_refresh_token_123',
      };

      // Mock updated connection
      mockPrismaState.connectionFindUniqueResult = {
        ...mockConnection,
        user: {
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com'
        },
        tokens: [{
          ...mockToken,
          accessToken: 'new_access_token_123',
          refreshToken: 'new_refresh_token_123',
        }]
      };

      const result = await service.handleCallback('auth_code_123', 'test-state-123');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'conn_123',
          userId: 'user_123',
          tenantId: 'tenant_123',
          clientId: 'client_123',
          user: expect.objectContaining({
            id: 'user_123',
            name: 'Test User',
            email: 'test@example.com'
          }),
          tokens: expect.arrayContaining([
            expect.objectContaining({
              accessToken: 'new_access_token_123',
              refreshToken: 'new_refresh_token_123'
            })
          ])
        })
      );
    });

    it('should handle invalid OAuth session', async () => {
      mockPrismaState.sessionFindResult = null;

      await expect(service.handleCallback('auth_code_123', 'invalid-state'))
        .rejects
        .toThrow('Invalid or expired OAuth session');
    });

    it('should handle expired OAuth session', async () => {
      mockPrismaState.sessionFindResult = {
        id: 'session_123',
        state: 'test-state-123',
        codeVerifier: 'test-code-verifier',
        userId: 'user_123',
        expiresAt: new Date(Date.now() - 300000), // 5 minutes ago (expired)
        user: {
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      await expect(service.handleCallback('auth_code_123', 'test-state-123'))
        .rejects
        .toThrow('OAuth session has expired');
    });

    it('should handle missing active connection', async () => {
      mockPrismaState.sessionFindResult = {
        id: 'session_123',
        state: 'test-state-123',
        codeVerifier: 'test-code-verifier',
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 300000),
        user: {
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      mockPrismaState.connectionFindFirstResult = null;

      await expect(service.handleCallback('auth_code_123', 'test-state-123'))
        .rejects
        .toThrow('No active connection found for user');
    });

    it('should handle token exchange failure', async () => {
      mockPrismaState.sessionFindResult = {
        id: 'session_123',
        state: 'test-state-123',
        codeVerifier: 'test-code-verifier',
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 300000),
        user: {
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      mockPrismaState.connectionFindFirstResult = mockConnection;

      mockFetchState.response = {
        ok: false,
        status: 400,
        text: async () => 'Invalid authorization code',
      };

      await expect(service.handleCallback('invalid_code', 'test-state-123'))
        .rejects
        .toThrow('Token exchange failed: 400');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      mockPrismaState.connectionFindUniqueResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      const refreshResponse: GraphTokenResponse = {
        access_token: 'refreshed_access_token_123',
        refresh_token: 'refreshed_refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://graph.microsoft.com/Mail.Read offline_access',
      };

      mockFetchState.response = {
        ok: true,
        json: async () => refreshResponse,
      };

      mockPrismaState.tokenCreateResult = {
        ...mockToken,
        accessToken: 'refreshed_access_token_123',
        refreshToken: 'refreshed_refresh_token_123',
      };

      const result = await service.refreshToken('conn_123');

      expect(result).toBe(true);
    });

    it('should handle missing connection', async () => {
      mockPrismaState.connectionFindUniqueResult = null;

      const result = await service.refreshToken('invalid_conn');

      expect(result).toBe(false);
    });

    it('should handle missing refresh token', async () => {
      mockPrismaState.connectionFindUniqueResult = {
        ...mockConnection,
        tokens: [{
          ...mockToken,
          refreshToken: undefined
        }]
      };

      const result = await service.refreshToken('conn_123');

      expect(result).toBe(false);
    });

    it('should handle token refresh API failure', async () => {
      mockPrismaState.connectionFindUniqueResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: false,
        status: 400,
        text: async () => 'Invalid refresh token',
      };

      const result = await service.refreshToken('conn_123');

      expect(result).toBe(false);
    });
  });

  describe('revokeTokens', () => {
    it('should successfully revoke tokens', async () => {
      mockPrismaState.connectionFindUniqueResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: true,
      };

      mockPrismaState.tokenDeleteManyResult = { count: 1 };

      const result = await service.revokeTokens('conn_123');

      expect(result).toBe(true);
    });

    it('should handle missing connection gracefully', async () => {
      mockPrismaState.connectionFindUniqueResult = null;

      const result = await service.revokeTokens('invalid_conn');

      expect(result).toBe(true); // Returns true when nothing to revoke
    });

    it('should continue with local cleanup if remote revocation fails', async () => {
      mockPrismaState.connectionFindUniqueResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      // Mock fetch failure for revocation
      const originalFetch = global.fetch;
      global.fetch = (async () => {
        throw new Error('Network error');
      }) as any;

      mockPrismaState.tokenDeleteManyResult = { count: 1 };

      const result = await service.revokeTokens('conn_123');

      expect(result).toBe(true);

      // Restore
      global.fetch = originalFetch;
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired OAuth sessions', async () => {
      mockPrismaState.sessionDeleteManyResult = { count: 3 };

      await expect(service.cleanupExpiredSessions())
        .resolves
        .not.toThrow();
    });

    it('should handle database errors during cleanup', async () => {
      const originalDeleteMany = mockPrisma.exchangeOAuthSession.deleteMany;
      mockPrisma.exchangeOAuthSession.deleteMany = async () => {
        throw new Error('Database error');
      };

      // Should not throw - errors are logged but not propagated
      await expect(service.cleanupExpiredSessions())
        .resolves
        .not.toThrow();

      // Restore
      mockPrisma.exchangeOAuthSession.deleteMany = originalDeleteMany;
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing client secret', async () => {
      const originalSecret = process.env.MICROSOFT_CLIENT_SECRET;
      delete process.env.MICROSOFT_CLIENT_SECRET;

      mockPrismaState.sessionFindResult = {
        id: 'session_123',
        state: 'test-state-123',
        codeVerifier: 'test-code-verifier',
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 300000),
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com' }
      };

      mockPrismaState.connectionFindFirstResult = mockConnection;

      await expect(service.handleCallback('auth_code_123', 'test-state-123'))
        .rejects
        .toThrow('Microsoft client secret not configured');

      // Restore
      process.env.MICROSOFT_CLIENT_SECRET = originalSecret;
    });

    it('should use default redirect URI when not configured', async () => {
      const originalUri = process.env.MICROSOFT_REDIRECT_URI;
      delete process.env.MICROSOFT_REDIRECT_URI;

      mockPrismaState.sessionCreateResult = {
        id: 'session_123',
        state: 'test-state-123',
        codeVerifier: 'test-code-verifier',
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 600000),
      };

      const result = await service.generateAuthUrl('user_123', 'tenant_123', 'client_123');

      const url = new URL(result.authUrl);
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/v1/exchange/oauth/callback');

      // Restore
      if (originalUri) {
        process.env.MICROSOFT_REDIRECT_URI = originalUri;
      }
    });
  });
});
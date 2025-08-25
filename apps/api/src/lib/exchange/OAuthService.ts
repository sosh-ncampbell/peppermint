import { PrismaClient } from '@prisma/client';
import type { 
  OAuthUrlParams, 
  GraphTokenResponse, 
  ExchangeConnectionData,
  IOAuthService 
} from '../../types/exchange';
import { generateState, generatePKCECodes } from './crypto';
import { exchangeLogger } from './logger';

export class OAuthService implements IOAuthService {
  private prisma: PrismaClient;
  private authUrl = 'https://login.microsoftonline.com';
  private scopes = 'https://graph.microsoft.com/Mail.Read offline_access';
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate OAuth authorization URL with PKCE
   */
  async generateAuthUrl(userId: string, tenantId: string, clientId: string): Promise<OAuthUrlParams> {
    try {
      const state = generateState();
      const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePKCECodes();
      
      // Store OAuth session
      const sessionExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await this.prisma.exchangeOAuthSession.create({
        data: {
          state,
          codeVerifier,
          userId,
          expiresAt: sessionExpiry
        }
      });

      const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 
                         `${process.env.API_BASE_URL}/api/v1/exchange/oauth/callback`;

      const authUrl = new URL(`${this.authUrl}/${tenantId}/oauth2/v2.0/authorize`);
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', this.scopes);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', codeChallengeMethod);
      authUrl.searchParams.append('response_mode', 'query');

      return {
        authUrl: authUrl.toString(),
        state,
        codeVerifier
      };
    } catch (error) {
      exchangeLogger.oauthError(userId, error as Error, 'AUTH_URL_GENERATION_FAILED');
      throw new Error('Failed to generate authorization URL');
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string): Promise<ExchangeConnectionData> {
    try {
      // Retrieve and validate OAuth session
      const session = await this.prisma.exchangeOAuthSession.findUnique({
        where: { state },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Invalid or expired OAuth session');
      }

      if (new Date() > session.expiresAt) {
        // Clean up expired session
        await this.prisma.exchangeOAuthSession.delete({
          where: { id: session.id }
        });
        throw new Error('OAuth session has expired');
      }

      // Find the connection being established
      const connection = await this.prisma.exchangeConnection.findFirst({
        where: { 
          userId: session.userId,
          isActive: true 
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!connection) {
        throw new Error('No active connection found for user');
      }

      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      if (!clientSecret) {
        throw new Error('Microsoft client secret not configured');
      }

      const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 
                         `${process.env.API_BASE_URL}/api/v1/exchange/oauth/callback`;

      // Exchange authorization code for tokens
      const tokenUrl = `${this.authUrl}/${connection.tenantId}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: connection.clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: session.codeVerifier
        }).toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        exchangeLogger.error('Token exchange failed', {
          error: new Error(`Token exchange failed: ${response.status} - ${errorText}`),
          operation: 'oauth_token_exchange',
          httpStatus: response.status
        });
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokenData: GraphTokenResponse = await response.json() as GraphTokenResponse;
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Store tokens
      await this.prisma.exchangeToken.create({
        data: {
          connectionId: connection.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenType: tokenData.token_type,
          expiresAt,
          scope: tokenData.scope
        }
      });

      // Clean up OAuth session
      await this.prisma.exchangeOAuthSession.delete({
        where: { id: session.id }
      });

      // Return connection with user data
      const updatedConnection = await this.prisma.exchangeConnection.findUnique({
        where: { id: connection.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          tokens: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!updatedConnection) {
        throw new Error('Failed to retrieve updated connection');
      }

      return {
        id: updatedConnection.id,
        userId: updatedConnection.userId,
        tenantId: updatedConnection.tenantId,
        clientId: updatedConnection.clientId,
        isActive: updatedConnection.isActive,
        createdAt: updatedConnection.createdAt,
        updatedAt: updatedConnection.updatedAt,
        user: updatedConnection.user,
        tokens: updatedConnection.tokens.map((token: any) => ({
          id: token.id,
          connectionId: token.connectionId,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken || undefined,
          tokenType: token.tokenType,
          expiresAt: token.expiresAt,
          scope: token.scope || undefined,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt
        }))
      };

    } catch (error) {
      exchangeLogger.oauthError('', error as Error, 'OAUTH_CALLBACK_ERROR');
      throw error;
    }
  }

  /**
   * Refresh an access token using refresh token
   */
  async refreshToken(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.prisma.exchangeConnection.findUnique({
        where: { id: connectionId },
        include: { 
          tokens: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!connection || !connection.tokens.length || !connection.tokens[0].refreshToken) {
        return false;
      }

      const currentToken = connection.tokens[0];
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      
      if (!clientSecret) {
        throw new Error('Microsoft client secret not configured');
      }

      const tokenUrl = `${this.authUrl}/${connection.tenantId}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: connection.clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: currentToken.refreshToken!,
          scope: this.scopes
        }).toString()
      });

      if (!response.ok) {
        exchangeLogger.tokenRefreshError(connectionId, new Error(`Token refresh failed: ${response.status}`));
        return false;
      }

      const tokenData: GraphTokenResponse = await response.json() as GraphTokenResponse;
      
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      await this.prisma.exchangeToken.create({
        data: {
          connectionId,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || currentToken.refreshToken,
          tokenType: tokenData.token_type,
          expiresAt,
          scope: tokenData.scope
        }
      });

      return true;

    } catch (error) {
      exchangeLogger.tokenRefreshError(connectionId, error as Error);
      return false;
    }
  }

  /**
   * Revoke tokens and clean up OAuth session
   */
  async revokeTokens(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.prisma.exchangeConnection.findUnique({
        where: { id: connectionId },
        include: { 
          tokens: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!connection || !connection.tokens.length) {
        return true; // Nothing to revoke
      }

      const token = connection.tokens[0];
      
      // Attempt to revoke the token with Microsoft
      if (token.refreshToken) {
        try {
          const revokeUrl = `${this.authUrl}/${connection.tenantId}/oauth2/v2.0/logout`;
          await fetch(revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              token: token.refreshToken,
              token_type_hint: 'refresh_token'
            }).toString()
          });
        } catch (error) {
          exchangeLogger.warn('Failed to revoke token with Microsoft', {
            connectionId,
            error: error as Error,
            operation: 'token_revocation'
          });
          // Continue with local cleanup even if remote revocation fails
        }
      }

      // Delete all tokens for this connection
      await this.prisma.exchangeToken.deleteMany({
        where: { connectionId }
      });

      return true;

    } catch (error) {
      exchangeLogger.error('Error revoking tokens', {
        connectionId,
        error: error as Error,
        operation: 'token_revocation_cleanup'
      });
      return false;
    }
  }

  /**
   * Clean up expired OAuth sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      await this.prisma.exchangeOAuthSession.deleteMany({
        where: {
          expiresAt: {
            lt: now
          }
        }
      });
    } catch (error) {
      exchangeLogger.error('Error cleaning up expired OAuth sessions', {
        error: error as Error,
        operation: 'oauth_session_cleanup'
      });
    }
  }
}

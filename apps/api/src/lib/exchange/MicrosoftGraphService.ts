import { PrismaClient } from '@prisma/client';
import type { 
  GraphTokenResponse, 
  GraphEmailMessage, 
  GraphEmailsResponse,
  IMicrosoftGraphService 
} from '../../types/exchange';
import { maskToken } from './crypto';
import { exchangeLogger, TokenRefreshError, ConnectionError } from './logger';

export class MicrosoftGraphService implements IMicrosoftGraphService {
  private prisma: PrismaClient;
  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private authUrl = 'https://login.microsoftonline.com';
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get a valid access token for the connection
   */
  async getAccessToken(connectionId: string): Promise<string> {
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
      throw new Error('No valid connection or tokens found');
    }

    const token = connection.tokens[0];
    
    // Check if token is still valid (with 5 minute buffer)
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = new Date();
    const expiresAt = new Date(token.expiresAt);
    
    if (expiresAt.getTime() - now.getTime() > expiryBuffer) {
      return token.accessToken;
    }

    // Token is expired or about to expire, refresh it
    const refreshed = await this.refreshAccessToken(connectionId);
    if (!refreshed) {
      throw new Error('Failed to refresh access token');
    }

    // Get the new token
    const newToken = await this.prisma.exchangeToken.findFirst({
      where: { connectionId },
      orderBy: { createdAt: 'desc' }
    });

    if (!newToken) {
      throw new Error('Failed to retrieve refreshed token');
    }

    return newToken.accessToken;
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(connectionId: string): Promise<boolean> {
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
        exchangeLogger.warn('No refresh token available for connection', { 
          connectionId,
          operation: 'refresh_token_missing'
        });
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
          scope: 'https://graph.microsoft.com/Mail.Read offline_access'
        }).toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        exchangeLogger.tokenRefreshError(connectionId, new Error(`Token refresh failed: ${response.status} ${errorText}`));
        return false;
      }

      const tokenData: GraphTokenResponse = await response.json() as GraphTokenResponse;
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Store new token
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

      exchangeLogger.tokenRefresh(connectionId);
      return true;

    } catch (error) {
      exchangeLogger.tokenRefreshError(connectionId, error as Error);
      return false;
    }
  }

  /**
   * Fetch emails from user's mailbox
   */
  async getEmails(connectionId: string, limit: number = 50): Promise<GraphEmailMessage[]> {
    try {
      const accessToken = await this.getAccessToken(connectionId);
      
      const url = `${this.baseUrl}/me/messages?$top=${limit}&$orderby=receivedDateTime desc`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Graph API error: ${response.status} - ${errorText}`);
      }

      const data: GraphEmailsResponse = await response.json() as GraphEmailsResponse;
      return data.value || [];

    } catch (error) {
      exchangeLogger.error('Error fetching emails', { 
        connectionId, 
        error: error as Error,
        operation: 'get_emails'
      });
      throw error;
    }
  }

  /**
   * Test the connection to Microsoft Graph
   */
  async testConnection(connectionId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken(connectionId);
      
      const response = await fetch(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      exchangeLogger.connectionTest(connectionId, false);
      return false;
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(connectionId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken(connectionId);
      
      const response = await fetch(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get user profile: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      exchangeLogger.error('Error getting user profile', {
        connectionId,
        error: error as Error,
        operation: 'get_user_profile'
      });
      throw error;
    }
  }

  /**
   * Send an email using Microsoft Graph API
   */
  async sendEmail(
    connectionId: string, 
    to: string, 
    subject: string, 
    body: string, 
    replyToMessageId?: string,
    customHeaders?: Record<string, string>
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken(connectionId);
      
      // Get optional Reply-To email address from environment
      const replyToEmail = process.env.EXCHANGE_REPLY_TO_EMAIL;
      
      const message: any = {
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: body
          },
          toRecipients: [{
            emailAddress: {
              address: to
            }
          }]
        }
      };

      // Add Reply-To header if configured
      if (replyToEmail) {
        message.message.replyTo = [{
          emailAddress: {
            address: replyToEmail,
            name: process.env.EXCHANGE_FROM_NAME || 'Support Team'
          }
        }];
      }

      // Prepare internet message headers
      const headers: Array<{ name: string; value: string }> = [];

      // Add reply-to headers if this is a reply
      if (replyToMessageId) {
        headers.push(
          {
            name: 'In-Reply-To',
            value: replyToMessageId
          },
          {
            name: 'References', 
            value: replyToMessageId
          }
        );
      }

      // Add custom headers (RFC-compliant ticket tracking)
      if (customHeaders) {
        Object.entries(customHeaders).forEach(([name, value]) => {
          headers.push({ name, value });
        });
      }

      // Apply headers if we have any
      if (headers.length > 0) {
        message.message.internetMessageHeaders = headers;
      }

      const response = await fetch(`${this.baseUrl}/me/sendMail`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      return response.ok;
    } catch (error) {
      exchangeLogger.error('Error sending email', {
        connectionId,
        error: error as Error,
        operation: 'send_email'
      });
      return false;
    }
  }
}

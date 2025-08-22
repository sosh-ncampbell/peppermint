// Microsoft 365 Exchange Integration Types

export interface MicrosoftGraphConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

export interface ExchangeConnectionData {
  id: string;
  userId: string;
  tenantId: string;
  clientId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  tokens?: ExchangeTokenData[];
}

export interface ExchangeTokenData {
  id: string;
  connectionId: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: Date;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthSessionData {
  id: string;
  state: string;
  codeVerifier: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface EmailProcessingLogData {
  id: string;
  connectionId: string;
  messageId: string;
  subject?: string;
  sender?: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  ticketId?: string;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
}

export interface TicketEmailMappingData {
  id: string;
  ticketId: string;
  messageId: string;
  threadId?: string;
  createdAt: Date;
}

// Microsoft Graph API Types
export interface GraphTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface GraphEmailMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  body: {
    contentType: string;
    content: string;
  };
  receivedDateTime: string;
  conversationId: string;
  internetMessageId: string;
  hasAttachments: boolean;
}

export interface GraphEmailsResponse {
  '@odata.context': string;
  '@odata.nextLink'?: string;
  value: GraphEmailMessage[];
}

export interface PKCECodes {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export interface OAuthUrlParams {
  authUrl: string;
  state: string;
  codeVerifier: string;
}

// API Request/Response Types
export interface CreateConnectionRequest {
  tenantId: string;
  clientId: string;
}

export interface CreateConnectionResponse {
  success: boolean;
  connection?: ExchangeConnectionData;
  error?: string;
}

export interface OAuthInitiateResponse {
  success: boolean;
  authUrl?: string;
  error?: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
}

export interface OAuthCallbackResponse {
  success: boolean;
  connection?: ExchangeConnectionData;
  error?: string;
}

export interface ProcessEmailsRequest {
  connectionId: string;
  limit?: number;
}

export interface ProcessEmailsResponse {
  success: boolean;
  processed: number;
  errors: number;
  message: string;
}

export interface ExchangeConnectionListResponse {
  success: boolean;
  connections: ExchangeConnectionData[];
  total: number;
}

export interface ExchangeConnectionResponse {
  success: boolean;
  connection?: ExchangeConnectionData;
  error?: string;
}

// Service Interface Types
export interface IMicrosoftGraphService {
  getAccessToken(connectionId: string): Promise<string>;
  refreshAccessToken(connectionId: string): Promise<boolean>;
  getEmails(connectionId: string, limit?: number): Promise<GraphEmailMessage[]>;
  testConnection(connectionId: string): Promise<boolean>;
  sendEmail(connectionId: string, to: string, subject: string, body: string, replyToMessageId?: string): Promise<boolean>;
  getUserProfile(connectionId: string): Promise<any>;
}

export interface IOAuthService {
  generateAuthUrl(userId: string, tenantId: string, clientId: string): Promise<OAuthUrlParams>;
  handleCallback(code: string, state: string): Promise<ExchangeConnectionData>;
  refreshToken(connectionId: string): Promise<boolean>;
}

export interface IEmailProcessingService {
  processEmails(connectionId: string, limit?: number): Promise<{ processed: number; errors: number }>;
  createTicketFromEmail(message: GraphEmailMessage, connectionId: string): Promise<string>;
  linkEmailToTicket(messageId: string, ticketId: string, threadId?: string, connectionId?: string): Promise<void>;
  getProcessingStats(connectionId: string): Promise<{ total: number; success: number; failed: number; }>;
}

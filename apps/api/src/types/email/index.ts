// Email Provider Abstraction Types

export interface EmailMessage {
  to: string | string[];
  from?: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  messageId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IEmailProvider {
  sendEmail(message: EmailMessage): Promise<SendEmailResult>;
  testConnection(): Promise<boolean>;
  getProviderName(): string;
}

export interface EmailProviderConfig {
  provider: 'smtp' | 'exchange';
  connectionId?: string; // Required for Exchange
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export interface TicketEmailContext {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  userId?: string;
  isReply?: boolean;
  originalMessageId?: string;
  threadId?: string;
}
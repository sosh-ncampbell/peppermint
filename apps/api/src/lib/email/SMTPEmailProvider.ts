import nodemailer from 'nodemailer';
import type { 
  IEmailProvider, 
  EmailMessage, 
  SendEmailResult 
} from '../../types/email';

export class SMTPEmailProvider implements IEmailProvider {
  private transporter: nodemailer.Transporter;
  private config: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };

  constructor(config: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }) {
    this.config = config;
    this.transporter = nodemailer.createTransport(config);
  }

  getProviderName(): string {
    return 'SMTP';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return false;
    }
  }

  async sendEmail(message: EmailMessage): Promise<SendEmailResult> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: message.fromName ? `"${message.fromName}" <${message.from}>` : message.from,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      };

      // Add threading headers if provided
      if (message.inReplyTo) {
        mailOptions.inReplyTo = message.inReplyTo;
      }
      if (message.references) {
        mailOptions.references = message.references;
      }

      // Add custom headers for ticket tracking (RFC-compliant)
      if (message.headers) {
        mailOptions.headers = message.headers;
      }

      const result = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('SMTP email sending failed:', error);
      return {
        success: false,
        error: `SMTP sending failed: ${error}`
      };
    }
  }
}
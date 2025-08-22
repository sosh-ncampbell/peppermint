import { PrismaClient } from '@prisma/client';
import { EmailService } from '../email/EmailService';
import type { TicketEmailContext } from '../../types/email';

export class TicketNotificationService {
  private prisma: PrismaClient;
  private emailService: EmailService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.emailService = new EmailService(prisma);
  }

  /**
   * Send ticket assignment notification
   */
  async sendAssignmentNotification(ticketId: string, assigneeEmail: string): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          assignedTo: true,
          emailMappings: {
            orderBy: { createdAt: 'asc' },
            take: 1
          }
        }
      });

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const context: TicketEmailContext = {
        ticketId: ticket.id,
        ticketNumber: ticket.Number.toString(),
        subject: ticket.title,
        userId: ticket.assignedTo?.id,
        originalMessageId: ticket.emailMappings[0]?.messageId,
        threadId: ticket.emailMappings[0]?.threadId || undefined
      };

      const htmlContent = this.generateAssignmentEmailHtml(ticket);

      await this.emailService.sendTicketEmail(
        assigneeEmail,
        `Ticket Assigned: ${ticket.title}`,
        htmlContent,
        context
      );

      console.log(`Assignment notification sent for ticket ${ticket.Number} to ${assigneeEmail}`);
    } catch (error) {
      console.error('Error sending assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send ticket comment notification
   */
  async sendCommentNotification(
    ticketId: string,
    commentText: string,
    recipientEmail: string,
    isCustomerReply: boolean = false
  ): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          assignedTo: true,
          emailMappings: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const context: TicketEmailContext = {
        ticketId: ticket.id,
        ticketNumber: ticket.Number.toString(),
        subject: ticket.title,
        isReply: true,
        originalMessageId: ticket.emailMappings[0]?.messageId,
        threadId: ticket.emailMappings[0]?.threadId || undefined
      };

      const htmlContent = this.generateCommentEmailHtml(ticket, commentText, isCustomerReply);

      await this.emailService.sendTicketEmail(
        recipientEmail,
        isCustomerReply ? 'New Reply' : 'New Comment',
        htmlContent,
        context
      );

      console.log(`Comment notification sent for ticket ${ticket.Number} to ${recipientEmail}`);
    } catch (error) {
      console.error('Error sending comment notification:', error);
      throw error;
    }
  }

  /**
   * Send ticket status change notification
   */
  async sendStatusChangeNotification(
    ticketId: string, 
    newStatus: string,
    recipientEmail: string
  ): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          assignedTo: true,
          emailMappings: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const context: TicketEmailContext = {
        ticketId: ticket.id,
        ticketNumber: ticket.Number.toString(),
        subject: ticket.title,
        isReply: true,
        originalMessageId: ticket.emailMappings[0]?.messageId,
        threadId: ticket.emailMappings[0]?.threadId || undefined
      };

      const htmlContent = this.generateStatusChangeEmailHtml(ticket, newStatus);

      await this.emailService.sendTicketEmail(
        recipientEmail,
        `Status Updated: ${newStatus}`,
        htmlContent,
        context
      );

      console.log(`Status change notification sent for ticket ${ticket.Number} to ${recipientEmail}`);
    } catch (error) {
      console.error('Error sending status change notification:', error);
      throw error;
    }
  }

  /**
   * Send ticket creation notification
   */
  async sendCreationNotification(ticketId: string, recipientEmail: string): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          emailMappings: {
            orderBy: { createdAt: 'asc' },
            take: 1
          }
        }
      });

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const context: TicketEmailContext = {
        ticketId: ticket.id,
        ticketNumber: ticket.Number.toString(),
        subject: ticket.title,
        originalMessageId: ticket.emailMappings[0]?.messageId,
        threadId: ticket.emailMappings[0]?.threadId || undefined
      };

      const htmlContent = this.generateCreationEmailHtml(ticket);

      await this.emailService.sendTicketEmail(
        recipientEmail,
        'New Ticket Created',
        htmlContent,
        context
      );

      console.log(`Creation notification sent for ticket ${ticket.Number} to ${recipientEmail}`);
    } catch (error) {
      console.error('Error sending creation notification:', error);
      throw error;
    }
  }

  /**
   * Generate HTML content for assignment email
   */
  private generateAssignmentEmailHtml(ticket: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0;">Ticket Assignment</h2>
          <p style="color: #666; margin: 5px 0 0 0;">You have been assigned a new ticket</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">Ticket #${ticket.Number}</h3>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Status:</strong> ${ticket.isComplete ? 'Closed' : 'Open'}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleDateString()}</p>
          
          ${ticket.detail ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
              <h4 style="margin-top: 0;">Description:</h4>
              <div>${ticket.detail}</div>
            </div>
          ` : ''}
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 8px;">
          <p style="margin: 0; color: #1565c0;">
            <strong>Action Required:</strong> Please review and respond to this ticket.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML content for comment email
   */
  private generateCommentEmailHtml(ticket: any, commentText: string, isCustomerReply: boolean): string {
    const replyType = isCustomerReply ? 'Customer Reply' : 'Internal Comment';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0;">${replyType}</h2>
          <p style="color: #666; margin: 5px 0 0 0;">Ticket #${ticket.Number}: ${ticket.title}</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <div style="padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
            <div>${commentText}</div>
          </div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #e8f5e8; border-radius: 8px;">
          <p style="margin: 0; color: #2e7d32;">
            <strong>Next Steps:</strong> ${isCustomerReply ? 'Please review and respond to the customer.' : 'This comment has been added to the ticket.'}
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML content for status change email
   */
  private generateStatusChangeEmailHtml(ticket: any, newStatus: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0;">Ticket Status Update</h2>
          <p style="color: #666; margin: 5px 0 0 0;">Ticket #${ticket.Number}: ${ticket.title}</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <p><strong>Status changed to:</strong> <span style="color: #28a745; font-weight: bold;">${newStatus}</span></p>
          <p><strong>Updated:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML content for creation email
   */
  private generateCreationEmailHtml(ticket: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0;">New Ticket Created</h2>
          <p style="color: #666; margin: 5px 0 0 0;">Thank you for contacting support</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">Ticket #${ticket.Number}</h3>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Status:</strong> Open</p>
          <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleDateString()}</p>
          
          ${ticket.detail ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
              <h4 style="margin-top: 0;">Your Message:</h4>
              <div>${ticket.detail}</div>
            </div>
          ` : ''}
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 8px;">
          <p style="margin: 0; color: #856404;">
            <strong>What's Next:</strong> Our support team will review your ticket and respond shortly.
          </p>
        </div>
      </div>
    `;
  }
}
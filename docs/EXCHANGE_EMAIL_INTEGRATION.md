# Full Exchange Email Integration Implementation

## Overview
This implementation provides complete Exchange integration for both **inbound** and **outbound** email processing in the Peppermint helpdesk system, with proper email threading and ticket management.

## 🎯 Key Features Implemented

### 1. **Bidirectional Email Integration**
- ✅ **Inbound**: Emails → Tickets (with threading)
- ✅ **Outbound**: Ticket responses → Exchange emails
- ✅ **Threading**: Proper email conversation threading
- ✅ **Provider Selection**: Choose between SMTP or Exchange

### 2. **Enhanced Email Processing**
- ✅ **Conversation Threading**: Groups emails by conversation ID
- ✅ **Smart Ticket Creation**: First email creates ticket, replies become comments
- ✅ **Duplicate Prevention**: Prevents processing same email twice
- ✅ **Error Handling**: Comprehensive error logging and recovery

### 3. **Email Provider Abstraction**
- ✅ **IEmailProvider Interface**: Common interface for all providers
- ✅ **ExchangeEmailProvider**: Microsoft Graph API integration
- ✅ **SMTPEmailProvider**: Traditional SMTP wrapper
- ✅ **EmailService**: Smart routing between providers

### 4. **Updated Notification System**
- ✅ **TicketNotificationService**: Replaces old SMTP-only functions
- ✅ **Unified Email Templates**: HTML email templates for all notifications
- ✅ **Automatic Threading**: Reply-to headers for proper threading
- ✅ **Provider-Agnostic**: Works with both SMTP and Exchange

## 🏢 Microsoft Azure App Registration Setup

### **Prerequisites**
- Azure account with active subscription
- At least **Application Developer** role in Microsoft Entra ID
- Access to Exchange Online (Microsoft 365 subscription)
- Admin consent permissions for your organization

### **Step 1: Create App Registration**

1. **Sign in to Azure Portal**
   - Go to [Microsoft Entra admin center](https://entra.microsoft.com)
   - Sign in with appropriate permissions

2. **Create New Registration**
   - Navigate to **Entra ID** > **App registrations**
   - Click **New registration**

3. **Configure Basic Settings**
   ```
   Name: Peppermint Helpdesk Exchange Integration
   Supported account types: Accounts in this organizational directory only (Single tenant)
   Redirect URI: 
     Platform: Web
     URL: https://saruman.smartservices.tech/admin/exchange/callback
   ```

4. **Register the Application**
   - Click **Register**
   - **Record the Application (client) ID** - you'll need this for your `.env` file

### **Step 2: Configure API Permissions**

1. **Navigate to API Permissions**
   - In your app registration, go to **API permissions**
   - Click **Add a permission**

2. **Add Microsoft Graph Permissions**
   - Select **Microsoft Graph**
   - Choose **Delegated permissions**
   - Add the following permissions:

   | Permission | Type | Description | Required for |
   |------------|------|-------------|---------------|
   | `User.Read` | Delegated | Sign in and read user profile | Authentication |
   | `Mail.Read` | Delegated | Read user mail | Inbound email processing |
   | `Mail.Send` | Delegated | Send mail as user | Outbound email replies |
   | `offline_access` | Delegated | Maintain access to data | Token refresh |

3. **Grant Admin Consent**
   - Click **Grant admin consent for [Your Organization]**
   - Confirm by clicking **Yes**
   - Verify all permissions show "Granted" status

### **Step 3: Create Client Secret**

1. **Navigate to Certificates & secrets**
   - Go to **Certificates & secrets** in your app registration
   - Click **New client secret**

2. **Configure Secret**
   ```
   Description: Peppermint Exchange Integration Secret
   Expires: 24 months (recommended)
   ```

3. **Copy Secret Value**
   - **⚠️ CRITICAL**: Copy the secret **Value** immediately
   - This value will not be shown again after you navigate away
   - Store this securely - you'll need it for your `.env` file

### **Step 4: Configure Authentication Settings**

1. **Update Redirect URIs**
   - Go to **Authentication** section
   - Add additional redirect URIs for different environments:
   ```
   Development: http://localhost:3000/admin/exchange/callback
   Production: https://yourdomain.com/admin/exchange/callback
   ```

2. **Configure Advanced Settings**
   - **Access tokens**: ✅ Enabled
   - **ID tokens**: ✅ Enabled
   - **Allow public client flows**: ❌ Disabled (keep secure)

### **Step 5: Record Configuration Details**

After completing the app registration, record these values for your environment configuration:

```bash
# From Overview page
MICROSOFT_CLIENT_ID=your-application-client-id-here

# From Certificates & secrets
MICROSOFT_CLIENT_SECRET=your-client-secret-value-here

# From Overview page (if needed for multi-tenant)
MICROSOFT_TENANT_ID=your-directory-tenant-id-here

# Your configured redirect URI
MICROSOFT_REDIRECT_URI=http://localhost:3000/admin/exchange/callback
```

## 🔧 Your Specific Use Case Configuration

Based on your setup with `tickets@smartofficesinc.com` (OAuth account) and `support@smartofficesinc.com` (distribution group):

### **Environment Variables**
```bash
# OAuth authentication uses the real mailbox account
EXCHANGE_FROM_EMAIL=tickets@smartofficesinc.com
EXCHANGE_FROM_NAME=Smart Offices Support

# Replies go to your distribution group
EXCHANGE_REPLY_TO_EMAIL=support@smartofficesinc.com

# Microsoft Azure App Registration
MICROSOFT_CLIENT_ID=your-app-client-id
MICROSOFT_CLIENT_SECRET=your-app-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/admin/exchange/callback
```

### **How It Works**
1. **Authentication**: Uses `tickets@smartofficesinc.com` for OAuth (real mailbox required by Microsoft)
2. **Email Sending**: Sends from `tickets@` account through Microsoft Graph API
3. **Reply Handling**: Sets Reply-To header to `support@smartofficesinc.com`
4. **Distribution**: Customers reply to distribution group, which includes the `tickets@` account
5. **Processing**: System polls `tickets@` mailbox, processes emails, creates tickets

### **Permissions Rationale**
- **Mail.Read**: Required to read incoming emails from `tickets@smartofficesinc.com`
- **Mail.Send**: Required to send replies through the `tickets@` account
- **User.Read**: Required for authentication and user profile access
- **offline_access**: Enables token refresh for continuous operation

## ⚠️ Important Security Notes

### **Client Secret Management**
- Store client secrets in secure environment variables
- Use Azure Key Vault for production environments
- Rotate secrets before expiration
- Never commit secrets to version control

### **Redirect URI Security**
- Use HTTPS in production environments
- Validate redirect URIs match exactly
- Avoid wildcard URIs for security

### **Scope Principle**
- Request minimum required permissions
- Use delegated permissions (not application permissions) for user context
- Consider mailbox access policies if needed

### **Token Management**
- Implement proper token refresh logic
- Store tokens securely (encrypted at rest)
- Handle token expiration gracefully

## 🧪 Testing Your Configuration

### **1. Test App Registration**
```bash
# Verify OAuth flow works
curl -X GET "https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/admin/exchange/callback&scope=https://graph.microsoft.com/Mail.Read%20https://graph.microsoft.com/Mail.Send%20https://graph.microsoft.com/User.Read%20offline_access"
```

### **2. Test API Access**
After OAuth setup, test with your application:
```javascript
// Test connection through your application
POST /api/v1/email-provider/test
{
  "provider": "exchange",
  "connectionId": "your-connection-id",
  "testEmail": "admin@smartofficesinc.com"
}
```

### **3. Verify Permissions**
Check that your app has proper permissions in Microsoft Graph:
- Go to **Azure Portal** > **Enterprise Applications**
- Find your app > **Permissions**
- Verify all permissions are granted and show green checkmarks

## 📁 New Files Created

### Core Email System
```
apps/api/src/types/email/index.ts                    # Email provider types
apps/api/src/lib/email/EmailService.ts               # Main email routing service
apps/api/src/lib/email/ExchangeEmailProvider.ts      # Exchange provider implementation
apps/api/src/lib/email/SMTPEmailProvider.ts          # SMTP provider wrapper
```

### Enhanced Notifications
```
apps/api/src/lib/notifications/TicketNotificationService.ts  # Unified notification service
```

### API Controllers
```
apps/api/src/controllers/emailProvider.ts            # Email provider management API
```

## 🔧 Configuration Updates

### Environment Variables (.env.exchange.example)
```bash
# OAuth Configuration - UPDATED
EXCHANGE_OAUTH_SCOPES=https://graph.microsoft.com/Mail.Read,https://graph.microsoft.com/Mail.Send,https://graph.microsoft.com/User.Read

# Email Provider Configuration - NEW
EMAIL_PROVIDER=smtp  # or 'exchange'
EXCHANGE_FROM_NAME=Support Team
EXCHANGE_FROM_EMAIL=support@yourdomain.com
```

### Interface Updates
```typescript
# Updated IMicrosoftGraphService to include:
sendEmail(connectionId: string, to: string, subject: string, body: string, replyToMessageId?: string): Promise<boolean>
getUserProfile(connectionId: string): Promise<any>

# Updated IEmailProcessingService to include:
getProcessingStats(connectionId: string): Promise<{ total: number; success: number; failed: number; }>
```

## 🚀 How It Works

### Inbound Email Processing
```typescript
1. EmailProcessingService.processEmailsWithThreading()
   ├── Fetches emails from Exchange via Microsoft Graph API
   ├── Groups emails by conversation ID for threading
   └── For each conversation:
       ├── First email → Creates new ticket
       ├── Reply emails → Adds comments to existing ticket
       └── Links all emails to ticket with threading info
```

### Outbound Email Processing
```typescript
1. TicketNotificationService.sendTicketEmail()
   ├── EmailService.initializeProvider() // Chooses SMTP or Exchange
   ├── Formats email with threading headers
   ├── Sends via appropriate provider (Exchange or SMTP)
   └── Logs outbound email for tracking
```

### Provider Selection Logic
```typescript
1. EmailService.loadConfiguration()
   ├── If EMAIL_PROVIDER=exchange:
   │   ├── Finds active Exchange connection
   │   └── Uses ExchangeEmailProvider
   └── If EMAIL_PROVIDER=smtp:
       └── Uses SMTPEmailProvider with env vars
```

## 🔄 Email Threading Implementation

### Inbound Threading
- Groups incoming emails by `conversationId` from Microsoft Graph
- First email in conversation creates ticket
- Subsequent emails in conversation become ticket comments
- Maintains `threadId` in `TicketEmailMapping` for tracking

### Outbound Threading
- Uses original email `messageId` as `In-Reply-To` header
- Includes ticket number in subject: `[Ticket #123] Subject`
- Preserves email thread continuity for proper client display

## 📊 API Endpoints

### Email Provider Management
```http
GET    /api/v1/email-provider/config     # Get current provider configuration
POST   /api/v1/email-provider/test       # Test provider connection & send test email
GET    /api/v1/email-provider/stats      # Get email processing statistics
```

## 🔧 Integration Points

### Updated Controllers
- **apps/api/src/controllers/ticket.ts**: Replaced all email functions with TicketNotificationService
- Functions replaced:
  - `sendTicketCreate()` → `notificationService.sendCreationNotification()`
  - `sendAssignedEmail()` → `notificationService.sendAssignmentNotification()`
  - `sendComment()` → `notificationService.sendCommentNotification()`
  - `sendTicketStatus()` → `notificationService.sendStatusChangeNotification()`

### Enhanced Features
- **Conversation Threading**: Better email conversation management
- **Duplicate Detection**: Prevents reprocessing same emails
- **Error Recovery**: Comprehensive error handling and logging
- **Provider Testing**: Built-in connection and email testing
- **Statistics**: Email processing metrics and reporting

## 🎯 Usage Examples

### Setting Up Exchange for Email Sending
```bash
# 1. Update environment variables
EMAIL_PROVIDER=exchange
EXCHANGE_FROM_EMAIL=support@company.com
EXCHANGE_FROM_NAME=Company Support

# 2. Ensure OAuth scopes include Mail.Send
EXCHANGE_OAUTH_SCOPES=https://graph.microsoft.com/Mail.Read,https://graph.microsoft.com/Mail.Send,https://graph.microsoft.com/User.Read

# 3. Restart application to pick up new configuration
```

### Testing Email Integration
```typescript
// Test Exchange connection
POST /api/v1/email-provider/test
{
  "provider": "exchange",
  "connectionId": "conn_123",
  "testEmail": "admin@company.com"
}
```

### Processing Emails with Threading
```typescript
const emailProcessor = new EmailProcessingService(prisma);
const result = await emailProcessor.processEmailsWithThreading('conn_123', 50);
console.log(`Processed: ${result.processed}, Errors: ${result.errors}`);
```

## 🛡️ Error Handling

- **Connection Failures**: Graceful fallback and error logging
- **Token Expiry**: Automatic token refresh for Exchange
- **Email Failures**: Detailed error messages and retry logic
- **Threading Issues**: Fallback to basic ticket creation if threading fails

## 📈 Benefits Achieved

1. **Unified System**: Single system handles both inbound and outbound emails
2. **Better Threading**: Proper email conversation management
3. **Provider Flexibility**: Easy switching between SMTP and Exchange
4. **Enhanced Reliability**: Better error handling and duplicate prevention
5. **Improved User Experience**: Proper email threading in client applications
6. **Admin Control**: Management interface for email provider configuration

This implementation provides a complete, production-ready email integration system that can handle both SMTP and Exchange emails with proper threading, error handling, and administrative controls.
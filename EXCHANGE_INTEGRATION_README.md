# Microsoft 365 Exchange Integration

This integration allows Peppermint to automatically create tickets from emails received in Microsoft 365 Exchange mailboxes.

## Features

- **OAuth 2.0 Authentication**: Secure authentication with Microsoft 365 using PKCE flow
- **Automatic Ticket Creation**: Convert emails to tickets automatically
- **Email Threading**: Link related emails to existing tickets
- **Rate Limiting**: Respect Microsoft Graph API limits
- **Email Processing Logs**: Track all processed emails
- **Admin Interface**: Web-based management of Exchange connections

## Prerequisites

1. **Node.js 24.6.0+**: This integration requires Node.js 24.6.0 or higher
2. **Yarn Package Manager**: Uses Yarn 4.2.2+ for dependency management
3. **Microsoft 365 Admin Access**: You need admin access to register an Azure application
4. **Azure App Registration**: Create an application in Azure AD with appropriate permissions
5. **Database**: Ensure PostgreSQL database is running and accessible

## Setup Instructions

### 1. Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: Peppermint Exchange Integration
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: `http://localhost:3000/admin/exchange/callback` (adjust for your domain)
5. Click **Register**

### 2. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add these permissions:
   - `Mail.Read`
   - `User.Read`
6. Click **Grant admin consent**

### 3. Create Client Secret (Optional)

For server-to-server scenarios:
1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add description and set expiration
4. Copy the secret value (you won't see it again)

### 4. Environment Configuration

Copy the example environment file:
```bash
cp .env.exchange.example .env.local
```

Update the values in `.env.local`:
```env
EXCHANGE_OAUTH_REDIRECT_URI=https://yourdomain.com/admin/exchange/callback
```

### 5. Database Migration

Run the database migration:
```bash
cd apps/api
yarn generate
yarn db:migrate
```

### 6. Start the Application

```bash
yarn dev
```

## Usage

### Creating an Exchange Connection

1. Navigate to **Admin** > **Exchange Integration**
2. Click **Add Connection**
3. Enter your **Tenant ID** and **Client ID** from Azure
4. Click **Create Connection**

### Authenticating the Connection

1. In the connections list, click the **Actions** menu
2. Select **Authenticate**
3. You'll be redirected to Microsoft for authentication
4. Grant the requested permissions
5. You'll be redirected back to Peppermint

### Processing Emails

You can process emails in two ways:

#### Manual Processing
1. Click **Actions** > **Process Emails** for a connection
2. This will process up to 50 recent emails

#### Automatic Processing (Recommended)
Set up a cron job or scheduled task to call:
```bash
curl -X POST "http://localhost:5003/api/v1/exchange/connections/{connectionId}/process-emails" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}' \
  --cookie-jar cookies.txt
```

## Email to Ticket Conversion

### New Tickets
- New emails create new tickets
- Subject becomes ticket title
- Email body becomes ticket description
- Sender becomes the ticket requester

### Existing Tickets
- Replies to emails with ticket references are added as comments
- Threading is maintained using Message-ID and References headers

### Ticket Assignment
- Tickets are assigned based on:
  1. Email routing rules (if configured)
  2. Default assignment rules
  3. Round-robin assignment (fallback)

## API Endpoints

### Connections
- `GET /api/v1/exchange/connections` - List connections
- `POST /api/v1/exchange/connections` - Create connection
- `DELETE /api/v1/exchange/connections/{id}` - Delete connection

### OAuth
- `POST /api/v1/exchange/connections/{id}/oauth/initiate` - Start OAuth flow
- `GET /api/v1/exchange/oauth/callback` - OAuth callback handler

### Email Processing
- `POST /api/v1/exchange/connections/{id}/process-emails` - Process emails
- `POST /api/v1/exchange/connections/{id}/test` - Test connection

## Troubleshooting

### Common Issues

#### "Authentication failed"
- Check your Tenant ID and Client ID
- Verify redirect URI matches Azure configuration
- Ensure API permissions are granted

#### "Rate limit exceeded"
- The integration respects Microsoft Graph rate limits
- Reduce processing frequency if needed
- Monitor the EmailProcessingLog table

#### "No emails processed"
- Check if the mailbox has new emails
- Verify the connection is authenticated
- Check the EmailProcessingLog for errors

### Logs

Check these locations for logs:
- Application logs: `apps/api/logs.log`
- Database logs: `EmailProcessingLog` table
- Browser console for OAuth issues

### Database Queries

Check processing status:
```sql
SELECT * FROM "EmailProcessingLog" 
WHERE "connectionId" = 'your-connection-id' 
ORDER BY "processedAt" DESC LIMIT 10;
```

Check OAuth sessions:
```sql
SELECT * FROM "ExchangeOAuthSession" 
WHERE "connectionId" = 'your-connection-id';
```

## Security Considerations

- Store client secrets securely (use environment variables)
- Use HTTPS in production
- Regularly rotate OAuth tokens
- Monitor access logs
- Implement proper CORS policies

## Rate Limiting

The integration implements several rate limiting mechanisms:
- Microsoft Graph API: 100 requests per minute per connection
- OAuth endpoints: Protected against abuse
- Email processing: Configurable batch sizes

## Monitoring

Monitor these metrics:
- OAuth token refresh frequency
- Email processing success/failure rates
- API rate limit usage
- Database performance

## Support

For issues with this integration:
1. Check the troubleshooting section above
2. Review application logs
3. Check the GitHub issues page
4. Contact support with relevant log excerpts

## License

This integration is part of Peppermint and follows the same license terms.

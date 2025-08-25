# RFC-Compliant Email Headers for Ticket Tracking

## Overview

This document outlines the RFC standards for email headers and how Peppermint implements robust ticket tracking using both standard and custom email headers.

## RFC Standards for Email Headers

### Core RFCs
- **RFC 5322** - Internet Message Format (current standard)
- **RFC 2822** - Internet Message Format (predecessor, still supported)
- **RFC 3834** - Auto-Submitted Header
- **RFC 2919** - List-Id Header (applicable patterns)

### Standard Threading Headers (RFC-Compliant)
```
Message-ID: <unique-identifier@domain.com>
In-Reply-To: <parent-message-id@domain.com>
References: <original-msg@domain.com> <parent-msg@domain.com>
```

## Custom Headers for Ticket Tracking

### RFC 5322 Custom Header Guidelines
According to RFC 5322, custom headers **are valid** and should follow the format:
```
X-[CompanyName]-[Purpose]: [Value]
```

### Peppermint Implementation
The system now automatically adds these RFC-compliant custom headers to all outgoing emails:

```
X-Peppermint-Ticket-ID: 550e8400-e29b-41d4-a716-446655440000
X-Peppermint-Ticket-Number: 123
X-Peppermint-System: peppermint-helpdesk
X-Peppermint-Message-Type: notification|reply
X-Peppermint-Thread-ID: thread-456 (when available)
X-Peppermint-Original-Message-ID: <original@example.com> (when available)
X-Auto-Response-Suppress: OOF, DR, RN, NRN, AutoReply
```

## Multi-Layer Tracking Resilience

### Layer 1: Standard RFC Threading
- **Message-ID**: Unique identifier for each email
- **In-Reply-To**: References parent message
- **References**: Full conversation chain
- **Subject**: `[Ticket #123] Subject` format

### Layer 2: Custom Headers (New)
- **X-Peppermint-Ticket-ID**: Primary ticket identifier
- **X-Peppermint-Ticket-Number**: Human-readable ticket number
- **X-Peppermint-Thread-ID**: Internal thread tracking

### Layer 3: Database Tracking
- **TicketEmailMapping**: Links messageId → ticketId
- **Conversation tracking**: Groups by conversationId
- **Thread persistence**: Maintains threadId relationships

## Benefits of This Approach

### ✅ RFC Compliance
- All custom headers follow RFC 5322 standards
- Compatible with all email clients and servers
- No interference with standard email processing

### ✅ Tracking Resilience
- **If subject line modified**: Custom headers still identify ticket
- **If threading broken**: Database mapping provides backup
- **If headers stripped**: Subject line pattern + database lookup
- **If all else fails**: Email address + timestamp correlation

### ✅ Email Client Compatibility
- **Outlook**: Supports custom headers and threading
- **Gmail**: Displays conversation threading correctly
- **Apple Mail**: Maintains thread relationships
- **Thunderbird**: Full custom header support

## Implementation Details

### SMTP Provider
```typescript
mailOptions.headers = {
  'X-Peppermint-Ticket-ID': context.ticketId,
  'X-Peppermint-Ticket-Number': context.ticketNumber,
  // ... other headers
};
```

### Exchange Provider
```typescript
message.message.internetMessageHeaders = [
  { name: 'X-Peppermint-Ticket-ID', value: ticketId },
  { name: 'X-Peppermint-Ticket-Number', value: ticketNumber },
  // ... other headers
];
```

## Recovery Mechanisms

If ticket tracking fails, the system can recover using:

1. **Custom Headers**: Extract ticket ID from X-Peppermint-* headers
2. **Subject Parsing**: Extract ticket number from `[Ticket #123]` pattern
3. **Database Lookup**: Match messageId in TicketEmailMapping
4. **Conversation ID**: Group emails by Exchange conversationId
5. **Email Address**: Match sender/recipient with ticket participants

## Best Practices

### ✅ Do
- Always include both standard and custom headers
- Use RFC-compliant X-[Company]-[Purpose] format
- Include X-Auto-Response-Suppress to prevent loops
- Maintain database tracking as primary source of truth

### ❌ Don't
- Don't use non-standard header formats
- Don't rely solely on subject line parsing
- Don't include sensitive data in headers
- Don't exceed reasonable header limits (keep values under 1000 chars)

## Standards References

- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322)
- [RFC 3834 - Auto-Submitted Header](https://tools.ietf.org/html/rfc3834)
- [RFC 2919 - List-Id Header](https://tools.ietf.org/html/rfc2919)
- [Microsoft Graph API - Internet Message Headers](https://docs.microsoft.com/en-us/graph/api/resources/internetmessageheader)

## Conclusion

This implementation provides **triple-redundancy** ticket tracking that is:
- **RFC-compliant** and standards-based
- **Resilient** to email client modifications
- **Compatible** with all major email systems
- **Recoverable** through multiple fallback mechanisms

The system now exceeds industry standards for email-based ticket tracking reliability.
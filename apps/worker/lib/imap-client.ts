import { ImapFlow, type ImapFlowOptions } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { getEmailCredentials } from '@repo/shared';

export interface EmailMessage {
  uid: number;
  messageId: string;
  subject: string;
  from: { address: string; name: string } | null;
  date: Date | null;
  htmlBody: string | null;
  textBody: string | null;
  rawEmail: ParsedMail;
}

export interface ImapConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  secure?: boolean;
}

export class ImapClient {
  private config: ImapConfig;
  private client: ImapFlow | null = null;

  constructor(config: ImapConfig) {
    this.config = {
      port: 993,
      secure: true,
      ...config,
    };
  }

  /**
   * Create ImapClient from tenant credentials stored in AWS Secrets Manager
   */
  static async fromTenant(tenantId: string): Promise<ImapClient> {
    const credentials = await getEmailCredentials(tenantId);

    if (!credentials.imapServer || !credentials.imapUser || !credentials.imapPassword) {
      throw new Error(`IMAP credentials not configured for tenant ${tenantId}`);
    }

    // Parse host and port from imapServer if it contains a colon
    const [host, portStr] = credentials.imapServer.split(':');
    const port = portStr ? parseInt(portStr, 10) : 993;

    return new ImapClient({
      host,
      port,
      user: credentials.imapUser,
      password: credentials.imapPassword,
      secure: true,
    });
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    const options: ImapFlowOptions = {
      host: this.config.host,
      port: this.config.port || 993,
      secure: this.config.secure !== false,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      logger: false, // Set to console for debugging
    };

    this.client = new ImapFlow(options);
    await this.client.connect();
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.client = null;
    }
  }

  /**
   * Ensure client is connected
   */
  private ensureConnected(): ImapFlow {
    if (!this.client) {
      throw new Error('IMAP client not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * List all mailboxes
   */
  async listMailboxes(): Promise<Array<{ path: string; name: string }>> {
    const client = this.ensureConnected();
    const list = await client.list();
    return list.map((box) => ({
      path: box.path,
      name: box.name,
    }));
  }

  /**
   * Find the correct folder path by trying common variations
   * @param folderName - The base folder name (e.g., "AtlassianOrders")
   * @returns The full path to the folder, or null if not found
   */
  async findFolderPath(folderName: string): Promise<string | null> {
    const client = this.ensureConnected();

    // Get all mailboxes
    const mailboxes = await client.list();

    // Try to find the folder by checking different path patterns
    const possiblePaths = [
      folderName,                           // AtlassianOrders
      `INBOX.${folderName}`,                // INBOX.AtlassianOrders
      `CalithoSuite.${folderName}`,         // CalithoSuite.AtlassianOrders
      `INBOX.CalithoSuite.${folderName}`,   // INBOX.CalithoSuite.AtlassianOrders
    ];

    // Check each possible path
    for (const path of possiblePaths) {
      const found = mailboxes.find((box) => box.path === path);
      if (found) {
        console.log(`✓ Found folder at: ${path}`);
        return path;
      }
    }

    // If not found in common paths, search by name in all mailboxes
    const foundByName = mailboxes.find((box) =>
      box.name === folderName || box.path.endsWith(`.${folderName}`) || box.path.endsWith(`/${folderName}`)
    );

    if (foundByName) {
      console.log(`✓ Found folder at: ${foundByName.path}`);
      return foundByName.path;
    }

    // List available folders for debugging
    console.log('❌ Folder not found. Available folders:');
    mailboxes.forEach((box) => console.log(`  - ${box.path}`));

    return null;
  }

  /**
   * Fetch unread emails from a specific mailbox/folder
   */
  async fetchUnreadEmails(folderPath: string): Promise<EmailMessage[]> {
    const client = this.ensureConnected();

    // Try to find the correct folder path
    const actualPath = await this.findFolderPath(folderPath);

    if (!actualPath) {
      throw new Error(`Folder "${folderPath}" not found. Please create the folder in your email account or check the folder name.`);
    }

    console.log(`📂 Using folder path: ${actualPath}`);

    // Select the mailbox
    const lock = await client.getMailboxLock(actualPath);

    try {
      const messages: EmailMessage[] = [];

      // Search for unseen messages
      const unseenMessages = await client.search({ seen: false });

      if (!unseenMessages || unseenMessages.length === 0) {
        return messages;
      }

      // Fetch messages
      for await (const message of client.fetch(unseenMessages, {
        envelope: true,
        source: true, // Get raw email source
        uid: true,
      })) {
        try {
          // Parse the email
          const parsed = await simpleParser(message.source as Buffer);

          const emailMessage: EmailMessage = {
            uid: message.uid,
            messageId: parsed.messageId || `${message.uid}`,
            subject: parsed.subject || '(no subject)',
            from: parsed.from?.value?.[0]
              ? {
                  address: parsed.from.value[0].address || '',
                  name: parsed.from.value[0].name || '',
                }
              : null,
            date: parsed.date || null,
            htmlBody: parsed.html ? String(parsed.html) : null,
            textBody: parsed.text || null,
            rawEmail: parsed,
          };

          messages.push(emailMessage);
        } catch (error) {
          console.error(`Error parsing message ${message.uid}:`, error);
        }
      }

      return messages;
    } finally {
      lock.release();
    }
  }

  /**
   * Mark email as seen/read
   */
  async markAsSeen(folderPath: string, uid: number): Promise<void> {
    const client = this.ensureConnected();

    // Find the correct folder path
    const actualPath = await this.findFolderPath(folderPath);
    if (!actualPath) {
      throw new Error(`Folder "${folderPath}" not found`);
    }

    const lock = await client.getMailboxLock(actualPath);

    try {
      await client.messageFlagsAdd({ uid }, ['\\Seen']);
    } finally {
      lock.release();
    }
  }

  /**
   * Delete email (move to trash or permanently delete)
   */
  async deleteEmail(folderPath: string, uid: number, permanent: boolean = false): Promise<void> {
    const client = this.ensureConnected();

    // Find the correct folder path
    const actualPath = await this.findFolderPath(folderPath);
    if (!actualPath) {
      throw new Error(`Folder "${folderPath}" not found`);
    }

    const lock = await client.getMailboxLock(actualPath);

    try {
      if (permanent) {
        // Permanently delete
        await client.messageFlagsAdd({ uid }, ['\\Deleted']);
        // Note: expunge is called automatically by imapflow when lock is released
      } else {
        // Move to trash (if trash folder exists)
        try {
          await client.messageMove({ uid }, 'Trash');
        } catch (error) {
          // If trash doesn't exist, just mark as deleted
          await client.messageFlagsAdd({ uid }, ['\\Deleted']);
        }
      }
    } finally {
      lock.release();
    }
  }

  /**
   * Move email to another folder
   */
  async moveEmail(sourcePath: string, uid: number, destinationPath: string): Promise<void> {
    const client = this.ensureConnected();
    const lock = await client.getMailboxLock(sourcePath);

    try {
      await client.messageMove({ uid }, destinationPath);
    } finally {
      lock.release();
    }
  }
}

/**
 * Helper function to safely execute IMAP operations with automatic connection handling
 */
export async function withImapClient<T>(
  tenantId: string,
  callback: (client: ImapClient) => Promise<T>
): Promise<T> {
  const client = await ImapClient.fromTenant(tenantId);

  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.disconnect();
  }
}

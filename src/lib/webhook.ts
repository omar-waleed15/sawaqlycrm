import dotenv from 'dotenv';

dotenv.config();

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export interface WebhookPayload {
  type: 'task' | 'reminder';
  action: 'created' | 'assigned';
  task?: {
    id: string;
    title: string;
    description?: string;
    priority?: string;
    due_date?: string;
  };
  reminder?: {
    id: string;
    content: string;
  };
  sender: {
    id: string;
    name: string;
    email: string;
  };
  receiver: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
}

export async function sendWebhookNotification(payload: WebhookPayload): Promise<void> {
  if (!N8N_WEBHOOK_URL) {
    console.log('[Webhook] N8N_WEBHOOK_URL is not set. Skipping notification dispatch.');
    return;
  }

  // Only dispatch if the receiver has a phone number set
  if (!payload.receiver.phone) {
    console.log(`[Webhook] Skipping webhook dispatch: Receiver ${payload.receiver.name} has no phone number set.`);
    return;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (process.env.WEBHOOK_SECRET) {
      headers['Authorization'] = `Bearer ${process.env.WEBHOOK_SECRET}`;
    }

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Webhook] n8n webhook returned status ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Webhook] Successfully dispatched notification to ${payload.receiver.name} (${payload.receiver.phone})`);
    }
  } catch (error) {
    console.error('[Webhook] Error sending notification webhook to n8n:', error);
  }
}

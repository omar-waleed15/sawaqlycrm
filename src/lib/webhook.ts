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
  const targetUrl = process.env.N8N_WEBHOOK_URL || 'https://joepush7758.app.n8n.cloud/webhook/d530c082-fd34-4595-94f2-9ab3fd9983dd';

  if (!targetUrl) {
    console.log('[Webhook] N8N_WEBHOOK_URL is not set. Skipping notification dispatch.');
    return;
  }

  console.log(`[Webhook] Dispatching ${payload.type} webhook (${payload.action}) for ${payload.receiver.name} to ${targetUrl}...`);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Webhook] n8n webhook returned status ${response.status} ${response.statusText}. Body: ${body}`);
    } else {
      console.log(`[Webhook] Successfully dispatched notification to ${payload.receiver.name}`);
    }
  } catch (error) {
    console.error('[Webhook] Error sending notification webhook to n8n:', error);
  }
}

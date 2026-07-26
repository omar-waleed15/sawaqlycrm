"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWebhookNotification = sendWebhookNotification;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
async function sendWebhookNotification(payload) {
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
        const headers = {
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
        }
        else {
            console.log(`[Webhook] Successfully dispatched notification to ${payload.receiver.name} (${payload.receiver.phone})`);
        }
    }
    catch (error) {
        console.error('[Webhook] Error sending notification webhook to n8n:', error);
    }
}

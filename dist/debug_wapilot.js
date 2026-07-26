"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const token = process.env.WAPILOT_API_TOKEN || '';
async function testStats() {
    const campaignId = 15975;
    console.log('Using Campaign ID:', campaignId);
    try {
        const res = await fetch(`https://api.wapilot.net/api/v2/campaigns/${campaignId}/messages/stats`, {
            method: 'GET',
            headers: {
                'token': token
            }
        });
        const data = await res.json();
        console.log('Status Code:', res.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));
    }
    catch (err) {
        console.error('Network Error:', err);
    }
}
testStats();

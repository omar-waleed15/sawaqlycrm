import { Router, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const WAPILOT_API_TOKEN = process.env.WAPILOT_API_TOKEN || '';
const WAPILOT_INSTANCE_ID = process.env.WAPILOT_INSTANCE_ID || '';

// Clean and extract phone numbers from text/CSV buffer
function parseCsvPhones(bufferText: string): string[] {
  const lines = bufferText.split(/\r?\n/);
  const phones: string[] = [];
  
  // We can skip a header line if it contains words like 'phone' or 'mobile'
  let skipHeader = false;
  if (lines.length > 0 && (lines[0].toLowerCase().includes('phone') || lines[0].toLowerCase().includes('number') || lines[0].toLowerCase().includes('mobile'))) {
    skipHeader = true;
  }

  for (let i = skipHeader ? 1 : 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Split by comma, semicolon, or tab
    const cols = line.split(/[,;\t]/);
    for (const col of cols) {
      const cleaned = col.trim().replace(/[+\s-()'"\\]/g, '');
      // Match 8-15 digits
      if (/^\d{8,15}$/.test(cleaned)) {
        phones.push(cleaned);
        break; // Take the first phone column in this line
      }
    }
  }
  return phones;
}

// GET /api/campaigns - List all campaigns (with real-time WAPilot stats)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Merge with real-time stats from WAPilot API
    const updatedCampaigns = await Promise.all((campaigns || []).map(async (c) => {
      if (!WAPILOT_API_TOKEN) return { ...c, stats: { pending_count: c.recipient_count, success_count: 0, failed_count: 0 } };
      try {
        const statsRes = await fetch(`https://api.wapilot.net/api/v2/campaigns/${c.wapilot_campaign_id}/messages/stats`, {
          headers: { 'token': WAPILOT_API_TOKEN }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json() as any;
          const s = statsData.data || {};
          const pending = s.messages_pending !== undefined ? s.messages_pending : (s.messages_in_queue || 0);
          const success = s.messages_success || 0;
          const failed = s.messages_failed || 0;
          
          let currentStatus = c.status;
          if (c.status === 'sending' && pending === 0 && (success + failed > 0)) {
            currentStatus = 'completed';
            // Async update database status to completed so it persists
            supabaseAdmin
              .from('campaigns')
              .update({ status: 'completed' })
              .eq('id', c.id)
              .then(({ error }) => {
                if (error) console.error('Failed to auto-update campaign status to completed', error);
              });
          }

          return { 
            ...c, 
            status: currentStatus,
            stats: { 
              pending_count: pending, 
              success_count: success, 
              failed_count: failed 
            } 
          };
        }
      } catch (err) {
        console.error(`Failed to fetch stats for WAPilot campaign ${c.wapilot_campaign_id}`, err);
      }
      return { ...c, stats: { pending_count: c.recipient_count, success_count: 0, failed_count: 0 } };
    }));

    res.json({ campaigns: updatedCampaigns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns - Create a new campaign (Upload CSV)
router.post('/', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, message_template } = req.body;
  const file = req.file;

  if (!name || !message_template) {
    res.status(400).json({ error: 'Campaign name and message template are required' });
    return;
  }

  if (!file) {
    res.status(400).json({ error: 'Client list file (CSV/TXT) is required' });
    return;
  }

  if (!WAPILOT_API_TOKEN || !WAPILOT_INSTANCE_ID) {
    res.status(500).json({ error: 'WAPilot credentials are not configured in the CRM server environment.' });
    return;
  }

  try {
    // 1. Parse file content
    const fileContent = file.buffer.toString('utf8');
    const phones = parseCsvPhones(fileContent);

    if (phones.length === 0) {
      res.status(400).json({ error: 'No valid phone numbers found in the uploaded file. Please verify phone number formatting.' });
      return;
    }

    // 2. Create Campaign on WAPilot
    const createRes = await fetch('https://api.wapilot.net/api/v2/campaigns', {
      method: 'POST',
      headers: {
        'token': WAPILOT_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.trim(),
        instance_uns: [WAPILOT_INSTANCE_ID]
      })
    });

    if (!createRes.ok) {
      const errData = await createRes.json() as any;
      res.status(createRes.status).json({ error: `WAPilot Create Campaign failed: ${errData.message || createRes.statusText}` });
      return;
    }

    const createData = await createRes.json() as any;
    const wapilotCampaignId = createData.campaign_id || createData.data?.id;

    // 3. Upload messages to WAPilot campaign
    const messagesPayload = phones.map(phone => ({
      phone_number: phone,
      text: message_template
    }));

    const uploadRes = await fetch(`https://api.wapilot.net/api/v2/campaigns/${wapilotCampaignId}/messages`, {
      method: 'POST',
      headers: {
        'token': WAPILOT_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messagesPayload
      })
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json() as any;
      res.status(uploadRes.status).json({ error: `WAPilot Add Messages failed: ${errData.message || uploadRes.statusText}` });
      return;
    }

    // Upload CSV to Supabase Storage
    let csvFileUrl = null;
    try {
      const storagePath = `campaigns/${wapilotCampaignId}_${Date.now()}_${file.originalname}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('attachments')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage
          .from('attachments')
          .getPublicUrl(storagePath);
        csvFileUrl = urlData.publicUrl;
      } else {
        console.error('Failed to upload campaign CSV to storage:', uploadError.message);
      }
    } catch (uploadErr) {
      console.error('Error during campaign CSV upload:', uploadErr);
    }

    // 4. Save campaign metadata to local CRM database
    const { data: campaign, error: dbError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        wapilot_campaign_id: wapilotCampaignId,
        name: name.trim(),
        status: 'pending',
        recipient_count: phones.length,
        csv_file_url: csvFileUrl
      })
      .select()
      .single();

    if (dbError) {
      res.status(500).json({ error: dbError.message });
      return;
    }

    res.json({ campaign });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/action - Trigger Start or Pause on WAPilot
router.post('/:id/action', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const { action } = req.body; // 'start' or 'pause'

  if (!['start', 'pause'].includes(action)) {
    res.status(400).json({ error: 'Action must be either "start" or "pause"' });
    return;
  }

  if (!WAPILOT_API_TOKEN) {
    res.status(500).json({ error: 'WAPilot token is missing.' });
    return;
  }

  try {
    // Retrieve campaign details
    const { data: campaign, error: getError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Call WAPilot API action endpoint
    const url = `https://api.wapilot.net/api/v2/campaigns/${campaign.wapilot_campaign_id}/${action}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'token': WAPILOT_API_TOKEN
      }
    });

    if (!response.ok) {
      const errData = await response.json() as any;
      res.status(response.status).json({ error: `WAPilot campaign action failed: ${errData.message || response.statusText}` });
      return;
    }

    // Update local database status
    const newStatus = action === 'start' ? 'sending' : 'paused';
    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.json({ campaign: updatedCampaign });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  try {
    // Delete campaign from local DB
    const { error } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

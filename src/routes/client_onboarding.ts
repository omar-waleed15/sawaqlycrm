import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator } from '../middleware/roleCheck';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Step field mapping for partial step updates (Step 1: Brief, Step 2: Advanced Data)
const STEP_KEY_MAP: Record<number, string> = {
  1: 'brief',
  2: 'advanced',
  3: 'business_discovery',
  4: 'target_audience',
  5: 'competitor_analysis',
  6: 'social_media_audit',
  7: 'content_strategy',
};

// GET /api/client-onboarding/:clientId
router.get('/:clientId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = req.params.clientId as string;

  try {
    // 1. Fetch client info
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*, sales_rep:profiles!clients_sales_rep_id_fkey(id, name)')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // 2. Fetch onboarding record
    let { data: onboarding, error: onboardingErr } = await supabaseAdmin
      .from('client_onboarding')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (onboardingErr) {
      res.status(500).json({ error: onboardingErr.message });
      return;
    }

    // If no onboarding record exists yet, create an initial default empty record
    if (!onboarding) {
      const initialOverview = {
        business_name: client.company || client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        company_status: client.status === 'active' ? 'Active Client' : 'Discovery',
      };

      const { data: newOnboarding, error: createErr } = await supabaseAdmin
        .from('client_onboarding')
        .insert({
          client_id: clientId,
          current_step: 1,
          completed_steps: [],
          client_overview: initialOverview,
        })
        .select()
        .single();

      if (createErr) {
        res.status(500).json({ error: createErr.message });
        return;
      }
      onboarding = newOnboarding;
    }

    res.json({ client, onboarding });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch client onboarding profile' });
  }
});

// PUT /api/client-onboarding/:clientId — Upsert full or partial onboarding
router.put('/:clientId', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = req.params.clientId as string;
  const { current_step, completed_steps, client_overview, brand_assets, business_discovery, target_audience, competitor_analysis, social_media_audit, content_strategy } = req.body;

  try {
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (current_step !== undefined) updates.current_step = current_step;
    if (completed_steps !== undefined) updates.completed_steps = completed_steps;
    if (client_overview !== undefined) updates.client_overview = client_overview;
    if (brand_assets !== undefined) updates.brand_assets = brand_assets;
    if (business_discovery !== undefined) updates.business_discovery = business_discovery;
    if (target_audience !== undefined) updates.target_audience = target_audience;
    if (competitor_analysis !== undefined) updates.competitor_analysis = competitor_analysis;
    if (social_media_audit !== undefined) updates.social_media_audit = social_media_audit;
    if (content_strategy !== undefined) updates.content_strategy = content_strategy;

    const { data: onboarding, error } = await supabaseAdmin
      .from('client_onboarding')
      .upsert({ client_id: clientId, ...updates }, { onConflict: 'client_id' })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ onboarding });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save onboarding data' });
  }
});

// PUT /api/client-onboarding/:clientId/step/:stepNum — Update specific step
router.put('/:clientId/step/:stepNum', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator, async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = req.params.clientId as string;
  const stepNum = req.params.stepNum as string;
  const stepNumber = parseInt(stepNum, 10);
  const stepKey = STEP_KEY_MAP[stepNumber];

  if (!stepKey) {
    res.status(400).json({ error: 'Invalid step number' });
    return;
  }

  const { stepData, completedSteps, currentStep } = req.body;

  try {
    // 1. Fetch current onboarding to merge steps
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('client_onboarding')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (fetchErr) {
      res.status(500).json({ error: fetchErr.message });
      return;
    }

    let existingCompleted: number[] = current?.completed_steps || [];
    if (completedSteps && Array.isArray(completedSteps)) {
      existingCompleted = completedSteps;
    } else if (!existingCompleted.includes(stepNumber)) {
      existingCompleted = [...existingCompleted, stepNumber];
    }

    const payload: Record<string, any> = {
      client_id: clientId,
      [stepKey]: stepData || {},
      completed_steps: existingCompleted,
      current_step: currentStep || stepNumber,
      updated_at: new Date().toISOString(),
    };

    const { data: onboarding, error } = await supabaseAdmin
      .from('client_onboarding')
      .upsert(payload, { onConflict: 'client_id' })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ onboarding });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save step' });
  }
});

// POST /api/client-onboarding/:clientId/upload — Upload asset file
router.post('/:clientId/upload', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = req.params.clientId as string;
  const category = (req.body.category || 'general').toLowerCase().replace(/[^a-z0-9_]/g, '_');

  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  try {
    const file = req.file;
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `client_onboarding/${clientId}/${category}/${Date.now()}_${sanitizedOriginalName}`;

    // Upload to Supabase Storage in 'attachments' bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('attachments')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      res.status(500).json({ error: uploadError.message });
      return;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('attachments')
      .getPublicUrl(storagePath);

    res.status(201).json({
      file: {
        name: file.originalname,
        category,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        mimetype: file.mimetype,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to upload asset file' });
  }
});

// DELETE /api/client-onboarding/:clientId/upload — Delete asset file
router.delete('/:clientId/upload', authMiddleware, ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator, async (req: AuthRequest, res: Response): Promise<void> => {
  const { storage_path } = req.body;

  if (!storage_path) {
    res.status(400).json({ error: 'storage_path is required' });
    return;
  }

  try {
    const { error } = await supabaseAdmin.storage
      .from('attachments')
      .remove([storage_path]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'File deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete file' });
  }
});

export default router;

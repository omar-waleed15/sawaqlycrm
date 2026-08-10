import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { scrapeSocialProfile, detectPlatformFromUrl } from '../services/scraperManager';

const router = Router();

// 1. POST /api/social/clients/:clientId/accounts/add-link — Track a social account via profile URL or handle
router.post('/clients/:clientId/accounts/add-link', authMiddleware, async (req: AuthRequest, res: Response) => {
  const clientId = req.params.clientId as string;
  const { profile_url, platform: requestedPlatform } = req.body;

  if (!profile_url) {
    return res.status(400).json({ error: 'profile_url is required' });
  }

  try {
    const platform = (requestedPlatform || detectPlatformFromUrl(profile_url)) as 'instagram' | 'tiktok' | 'facebook';

    // Run initial profile scrape
    console.log(`\n=== [Social Integration] Scraping Link Request ===`);
    console.log(`Platform: ${platform}, URL: ${profile_url}`);
    const scraped = await scrapeSocialProfile(platform, profile_url);

    (scraped.logs || []).forEach((log) => console.log(log));

    // Upsert into client_social_accounts
    const accountRecord = {
      client_id: clientId,
      platform: scraped.platform,
      account_id: scraped.account_id,
      account_name: scraped.account_name,
      profile_url: scraped.profile_url,
      avatar_url: scraped.avatar_url,
      updated_at: new Date().toISOString(),
    };

    const { data: accountData, error: accountErr } = await supabase
      .from('client_social_accounts')
      .upsert(accountRecord, { onConflict: 'client_id,platform,account_id' })
      .select()
      .single();

    if (accountErr) throw accountErr;

    // Save daily analytics snapshot
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyRecord = {
      client_id: clientId,
      account_id: scraped.account_id,
      platform: scraped.platform,
      record_date: todayStr,
      followers_count: scraped.followers_count,
      likes: scraped.likes_count || 0,
      impressions: scraped.posts_count || 0,
      reach: scraped.followers_count,
      comments_count: scraped.recent_posts.reduce((sum, p) => sum + p.comments_count, 0),
    };

    await supabase
      .from('client_social_analytics_daily')
      .upsert(dailyRecord, { onConflict: 'client_id,account_id,platform,record_date' });

    // Save recent scraped posts
    for (const post of scraped.recent_posts) {
      await supabase
        .from('client_social_posts')
        .upsert(
          {
            client_id: clientId,
            account_id: scraped.account_id,
            platform: scraped.platform,
            post_id: post.post_id,
            caption: post.caption,
            media_url: post.media_url,
            permalink: post.permalink,
            like_count: post.like_count,
            comments_count: post.comments_count,
            views_count: post.views_count || 0,
            posted_at: post.posted_at || new Date().toISOString(),
          },
          { onConflict: 'client_id,platform,post_id' }
        );
    }

    const warning =
      scraped.account_name === `@${scraped.account_id}` && scraped.followers_count === 0 && scraped.recent_posts.length === 0
        ? `Warning: Standard scraping was blocked or returned 0 public metrics for @${scraped.account_id}. Verify the handle/link is public.`
        : undefined;

    res.json({ success: true, account: accountData, scraped, warning, logs: scraped.logs });
  } catch (err: any) {
    console.error('Error adding social media link:', err);
    res.status(500).json({ error: err.message || 'Failed to add social media link' });
  }
});

// 2. GET /api/social/clients/:clientId/accounts — Get connected accounts for a client
router.get('/clients/:clientId/accounts', authMiddleware, async (req: AuthRequest, res: Response) => {
  const clientId = req.params.clientId as string;
  try {
    const { data, error } = await supabase
      .from('client_social_accounts')
      .select('id, client_id, platform, account_id, account_name, profile_url, avatar_url, connected_at, updated_at')
      .eq('client_id', clientId);

    if (error) throw error;
    res.json({ accounts: data || [] });
  } catch (err: any) {
    console.error('Error fetching social accounts:', err);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

// 3. DELETE /api/social/accounts/:id — Disconnect an account
router.delete('/accounts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { data: acc } = await supabase
      .from('client_social_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (acc) {
      await supabase
        .from('client_social_posts')
        .delete()
        .eq('client_id', acc.client_id)
        .eq('platform', acc.platform)
        .eq('account_id', acc.account_id);
    }

    const { error } = await supabase
      .from('client_social_accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Account disconnected successfully' });
  } catch (err: any) {
    console.error('Error deleting social account:', err);
    res.status(500).json({ error: 'Failed to disconnect social account' });
  }
});

// 3b. PUT /api/social/posts/:id — Update individual post title, caption, likes, comments, views
router.put('/posts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { caption, like_count, comments_count, views_count, media_url, permalink } = req.body;

  try {
    const updateData: any = {};
    if (caption !== undefined) updateData.caption = caption;
    if (like_count !== undefined) updateData.like_count = parseInt(like_count, 10);
    if (comments_count !== undefined) updateData.comments_count = parseInt(comments_count, 10);
    if (views_count !== undefined) updateData.views_count = parseInt(views_count, 10);
    if (media_url !== undefined) updateData.media_url = media_url;
    if (permalink !== undefined) updateData.permalink = permalink;

    const { data, error } = await supabase
      .from('client_social_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, post: data });
  } catch (err: any) {
    console.error('Error updating social post:', err);
    res.status(500).json({ error: 'Failed to update social post' });
  }
});

// 3c. DELETE /api/social/posts/:id — Delete an individual post
router.delete('/posts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('client_social_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting social post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// 3d. GET /api/social/settings — Fetch system social settings (e.g. Instagram session ID)
router.get('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'instagram_session_id')
      .maybeSingle();

    const rawSessionId = setting?.value || process.env.INSTAGRAM_SESSION_ID || '';
    res.json({
      instagram_session_id: rawSessionId,
      has_active_cookie: !!rawSessionId,
    });
  } catch (err: any) {
    console.error('Error fetching social settings:', err);
    res.status(500).json({ error: 'Failed to fetch social settings' });
  }
});

// 3e. PUT /api/social/settings — Update system social settings (e.g. Instagram session ID)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { instagram_session_id } = req.body;
  try {
    let cleanSessionId = (instagram_session_id || '').trim();

    if (cleanSessionId.includes('Failed') || cleanSessionId.includes('Error')) {
      cleanSessionId = '';
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'instagram_session_id',
          value: cleanSessionId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) throw error;
    res.json({
      success: true,
      message: 'Instagram Session Cookie updated successfully',
      has_active_cookie: !!cleanSessionId,
    });
  } catch (err: any) {
    console.error('Error updating social settings:', err);
    res.status(500).json({ error: err.message || 'Failed to update social settings' });
  }
});

// 4. POST /api/social/clients/:clientId/sync — Re-scrape metrics for all connected accounts
router.post('/clients/:clientId/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  const clientId = req.params.clientId as string;
  try {
    const { data: accounts } = await supabase
      .from('client_social_accounts')
      .select('*')
      .eq('client_id', clientId);

    if (!accounts || accounts.length === 0) {
      return res.json({ success: true, message: 'No accounts connected' });
    }

    const syncedResults = [];

    for (const acc of accounts) {
      const urlOrHandle = acc.profile_url || acc.account_id;
      const scraped = await scrapeSocialProfile(acc.platform as any, urlOrHandle);

      // Update account info
      await supabase
        .from('client_social_accounts')
        .update({
          account_name: scraped.account_name,
          avatar_url: scraped.avatar_url || acc.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', acc.id);

      // Upsert daily snapshot
      const todayStr = new Date().toISOString().split('T')[0];
      await supabase
        .from('client_social_analytics_daily')
        .upsert(
          {
            client_id: clientId,
            account_id: acc.account_id,
            platform: acc.platform,
            record_date: todayStr,
            followers_count: scraped.followers_count,
            likes: scraped.likes_count || 0,
            impressions: scraped.posts_count || 0,
            reach: scraped.followers_count,
            comments_count: scraped.recent_posts.reduce((s, p) => s + p.comments_count, 0),
          },
          { onConflict: 'client_id,account_id,platform,record_date' }
        );

      // Refresh post records
      if (scraped.recent_posts.length > 0) {
        await supabase
          .from('client_social_posts')
          .delete()
          .eq('client_id', clientId)
          .eq('platform', acc.platform)
          .eq('account_id', acc.account_id);

        for (const post of scraped.recent_posts) {
          await supabase
            .from('client_social_posts')
            .upsert(
              {
                client_id: clientId,
                account_id: acc.account_id,
                platform: acc.platform,
                post_id: post.post_id,
                caption: post.caption,
                media_url: post.media_url,
                permalink: post.permalink,
                like_count: post.like_count,
                comments_count: post.comments_count,
                views_count: post.views_count || 0,
                posted_at: post.posted_at || new Date().toISOString(),
              },
              { onConflict: 'client_id,platform,post_id' }
            );
        }
      }

      syncedResults.push({ platform: acc.platform, account_name: scraped.account_name, success: true });
    }

    res.json({ success: true, results: syncedResults });
  } catch (err: any) {
    console.error('Error syncing social metrics:', err);
    res.status(500).json({ error: err.message || 'Failed to sync social metrics' });
  }
});

// 5. GET /api/social/clients/:clientId/analytics — Get aggregated metrics & post activity
router.get('/clients/:clientId/analytics', authMiddleware, async (req: AuthRequest, res: Response) => {
  const clientId = req.params.clientId as string;
  try {
    const { data: accounts } = await supabase
      .from('client_social_accounts')
      .select('*')
      .eq('client_id', clientId);

    if (!accounts || accounts.length === 0) {
      return res.json({
        connected: false,
        accounts: [],
        summary: {
          total_followers: 0,
          total_likes: 0,
          total_comments: 0,
          total_posts: 0,
        },
        recent_posts: [],
        analytics_history: [],
      });
    }

    // Get latest snapshot per connected account
    let totalFollowers = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalPosts = 0;

    // Fetch all saved posts for accurate total likes/comments sum
    const { data: allPosts } = await supabase
      .from('client_social_posts')
      .select('*')
      .eq('client_id', clientId)
      .order('posted_at', { ascending: false });

    const safePosts = allPosts || [];

    if (safePosts.length > 0) {
      totalLikes = safePosts.reduce((sum, p) => sum + (p.like_count || 0), 0);
      totalComments = safePosts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    }

    // Latest daily stats per platform/account
    const { data: latestStats } = await supabase
      .from('client_social_analytics_daily')
      .select('*')
      .eq('client_id', clientId)
      .order('record_date', { ascending: false });

    const seenAccountKeys = new Set<string>();
    (latestStats || []).forEach(row => {
      const key = `${row.platform}_${row.account_id}`;
      if (!seenAccountKeys.has(key)) {
        seenAccountKeys.add(key);
        totalFollowers += row.followers_count || 0;
        if (totalLikes === 0) totalLikes += row.likes || 0;
        if (totalComments === 0) totalComments += row.comments_count || 0;
        totalPosts += row.impressions || 0;
      }
    });

    return res.json({
      connected: true,
      accounts: (accounts || []).map(a => ({
        id: a.id,
        platform: a.platform,
        account_name: a.account_name,
        profile_url: a.profile_url,
        avatar_url: a.avatar_url,
      })),
      summary: {
        total_followers: totalFollowers,
        total_likes: totalLikes,
        total_comments: totalComments,
        total_posts: totalPosts || safePosts.length,
      },
      recent_posts: safePosts.slice(0, 12).map(p => ({
        id: p.id,
        platform: p.platform,
        account_name: p.account_id,
        caption: p.caption || '',
        permalink: p.permalink || '',
        media_url: p.media_url || null,
        like_count: p.like_count || 0,
        comments_count: p.comments_count || 0,
        views_count: p.views_count || 0,
        timestamp: p.posted_at || p.created_at,
      })),
      analytics_history: latestStats || [],
    });
  } catch (err: any) {
    console.error('Error fetching social analytics:', err);
    return res.status(500).json({ error: 'Failed to fetch social analytics' });
  }
});

export default router;

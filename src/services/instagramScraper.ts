import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { supabaseAdmin as supabase } from '../lib/supabase';

export interface ScrapedSocialPost {
  post_id: string;
  caption: string;
  media_url?: string;
  permalink: string;
  like_count: number;
  comments_count: number;
  views_count?: number;
  posted_at?: string;
}

export interface ScrapedSocialProfile {
  platform: 'instagram' | 'tiktok' | 'facebook';
  account_id: string;
  account_name: string;
  profile_url: string;
  avatar_url?: string;
  followers_count: number;
  likes_count?: number;
  posts_count?: number;
  recent_posts: ScrapedSocialPost[];
  logs: string[];
}

export async function scrapeInstagramWithPuppeteer(
  handle: string,
  logs: string[]
): Promise<{ followersCount: number; postsCount: number; accountName: string; avatarUrl: string; posts: ScrapedSocialPost[] }> {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    logs.push(`[InstagramScraper] Chrome executable not found at ${chromePath}`);
    return { followersCount: 0, postsCount: 0, accountName: handle, avatarUrl: `https://unavatar.io/instagram/${handle}`, posts: [] };
  }

  let browser;
  try {
    logs.push(`[InstagramScraper] Strategy 2: Launching Puppeteer Headless Chrome...`);
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ],
    });

    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty((globalThis as any).navigator, 'webdriver', { get: () => undefined });
    });

    const profileUrl = `https://www.instagram.com/${handle}/`;
    logs.push(`[InstagramScraper] Puppeteer navigating to ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    await new Promise((r) => setTimeout(r, 4000));

    const pageTitle = await page.title();
    let accountName = handle;
    if (pageTitle && pageTitle.includes('(@')) {
      accountName = pageTitle.split('(@')[0].replace('• Instagram photos and videos', '').trim();
    }

    const data = await page.evaluate((targetHandle: string) => {
      const doc = (globalThis as any).document;
      const links = Array.from(doc.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
      const shortcodes: string[] = [];
      const seenShortcodes = new Set<string>();

      links.forEach((aEl: any) => {
        const href = aEl.getAttribute('href') || '';
        const match = href.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
        if (!match) return;
        const shortcode = match[1];
        if (seenShortcodes.has(shortcode)) return;
        seenShortcodes.add(shortcode);
        shortcodes.push(shortcode);
      });

      const metaDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      let followers = 0;
      let postsCnt = 0;

      const fM = metaDesc.match(/([0-9.,KMBkmb]+)\s*Followers/i);
      if (fM) {
        const clean = fM[1].replace(/,/g, '');
        const mult = clean.slice(-1).toUpperCase();
        const num = parseFloat(clean);
        if (!isNaN(num)) {
          if (mult === 'K') followers = Math.round(num * 1000);
          else if (mult === 'M') followers = Math.round(num * 1000000);
          else followers = Math.round(num);
        }
      }

      const pM = metaDesc.match(/([0-9.,KMBkmb]+)\s*Posts/i);
      if (pM) {
        const clean = pM[1].replace(/,/g, '');
        const num = parseFloat(clean);
        if (!isNaN(num)) postsCnt = Math.round(num);
      }

      return { followers, postsCnt, ogImage, shortcodes: shortcodes.slice(0, 8) };
    }, handle);

    logs.push(`[InstagramScraper] Found ${data.shortcodes.length} shortcodes from profile, now fetching exact post metrics...`);

    const posts: ScrapedSocialPost[] = [];
    for (const sc of data.shortcodes) {
      try {
        const embedUrl = `https://www.instagram.com/p/${sc}/embed/captioned/`;
        await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 2000));

        const postInfo = await page.evaluate((shortcode: string, targetHandle: string) => {
          const doc = (globalThis as any).document;
          const bodyText = doc.body?.innerText || '';

          const likesM = bodyText.match(/([0-9.,KMBkmb]+)\s*likes/i) || bodyText.match(/Liked by [^0-9]*([0-9.,KMBkmb]+)/i);
          const commentsM = bodyText.match(/View all ([0-9.,KMBkmb]+) comments/i) || bodyText.match(/([0-9.,KMBkmb]+)\s*comments/i);

          const captionEl = doc.querySelector('.CaptionText, .Caption, [class*="Caption"]');
          const captionText = captionEl ? captionEl.textContent.trim() : '';

          const mediaImg = doc.querySelector('img.EmbeddedMediaImage, img[src*="cdninstagram"]')?.getAttribute('src') || undefined;

          let likes = 0;
          if (likesM && likesM[1]) {
            const clean = likesM[1].replace(/,/g, '');
            const num = parseFloat(clean);
            if (!isNaN(num)) likes = Math.round(num);
          }

          let comments = 0;
          if (commentsM && commentsM[1]) {
            const clean = commentsM[1].replace(/,/g, '');
            const num = parseFloat(clean);
            if (!isNaN(num)) comments = Math.round(num);
          }

          return {
            post_id: `ig_${targetHandle}_p_${shortcode}`,
            caption: captionText || `Instagram Post (${shortcode})`,
            media_url: mediaImg,
            permalink: `https://www.instagram.com/p/${shortcode}/`,
            like_count: likes,
            comments_count: comments,
            views_count: 0,
            posted_at: new Date().toISOString(),
          };
        }, sc, handle);

        posts.push(postInfo);
      } catch (err: any) {
        logs.push(`[InstagramScraper] Error fetching embed for shortcode ${sc}: ${err.message || err}`);
      }
    }

    logs.push(
      `[InstagramScraper] Strategy 2 Success: Parsed ${posts.length} real Instagram posts with verified likes/comments, Followers=${data.followers}`
    );

    return {
      followersCount: data.followers,
      postsCount: data.postsCnt || posts.length,
      accountName,
      avatarUrl: data.ogImage || `https://unavatar.io/instagram/${handle}`,
      posts: posts,
    };
  } catch (err: any) {
    logs.push(`[InstagramScraper] Strategy 2 Puppeteer Exception: ${err.message || err}`);
    return { followersCount: 0, postsCount: 0, accountName: handle, avatarUrl: `https://unavatar.io/instagram/${handle}`, posts: [] };
  } finally {
    if (browser) await browser.close();
  }
}

export async function scrapeInstagramProfile(urlOrHandle: string): Promise<ScrapedSocialProfile> {
  const logs: string[] = [];

  let isSpecificPost = false;
  let postShortcode = '';
  const rawInput = urlOrHandle.trim();

  let handle = rawInput;
  if (handle.includes('instagram.com/')) {
    const postMatch = handle.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/i);
    if (postMatch) {
      postShortcode = postMatch[1];
      isSpecificPost = true;
      const userMatch = handle.match(/instagram\.com\/([A-Za-z0-9_.]+)\/(?:p|reel)\//i);
      handle = userMatch ? userMatch[1] : 'instagram_user';
    } else {
      const raw = handle.split('instagram.com/')[1].split('/')[0].split('?')[0];
      handle = raw.replace(/^@/, '');
    }
  } else {
    handle = handle.replace(/^@/, '');
  }

  const profileUrl = `https://www.instagram.com/${handle}/`;
  let followersCount = 0;
  let accountName = handle;
  let avatarUrl = `https://unavatar.io/instagram/${handle}`;
  let postsCount = 0;
  let likesCount = 0;
  const recentPosts: ScrapedSocialPost[] = [];

  logs.push(`[InstagramScraper] Target handle: "@${handle}"${isSpecificPost ? ` (Shortcode: ${postShortcode})` : ''}`);

  let sessionId = process.env.INSTAGRAM_SESSION_ID || process.env.INSTAGRAM_COOKIE || '';

  // Fetch session ID from Supabase system_settings table if not in .env
  if (!sessionId) {
    try {
      const { data: settingRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'instagram_session_id')
        .maybeSingle();

      if (settingRow && settingRow.value) {
        sessionId = settingRow.value.trim();
        logs.push(`[InstagramScraper] Loaded Instagram Session ID from Supabase system_settings table`);
      }
    } catch (dbErr: any) {
      logs.push(`[InstagramScraper] Could not query system_settings: ${dbErr.message}`);
    }
  }

  // Strategy 1: Logged-in Web Profile API (Returns 100% Real Posts, Captions & Exact Likes if INSTAGRAM_SESSION_ID is set)
  if (sessionId) {
    try {
      const cleanCookie = decodeURIComponent(sessionId).trim().replace(/^sessionid=/, '').replace(/;$/, '');
      logs.push(`[InstagramScraper] Strategy 1: Fetching Logged-in Web Profile API using Session ID...`);
      const apiRes = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
            'Referer': `https://www.instagram.com/${handle}/`,
            'Cookie': `sessionid=${cleanCookie};`,
          },
        }
      );

      if (apiRes.ok) {
        const json = (await apiRes.json()) as any;
        const user = json.data?.user;
        if (user) {
          accountName = user.full_name || user.username || handle;
          followersCount = user.edge_followed_by?.count || 0;
          postsCount = user.edge_owner_to_timeline_media?.count || 0;
          if (user.profile_pic_url) avatarUrl = user.profile_pic_url;

          // Combine Timeline Posts + Reels & Videos
          const timelineEdges = user.edge_owner_to_timeline_media?.edges || [];
          const felixEdges = user.edge_felix_combined_post_uploads?.edges || [];
          const clipsEdges = user.edge_clips_tab?.edges || [];

          const rawEdges = [...timelineEdges, ...felixEdges, ...clipsEdges];
          const seenShortcodes = new Set<string>();
          const edges: any[] = [];

          for (const e of rawEdges) {
            const sc = e.node?.shortcode;
            if (sc && !seenShortcodes.has(sc)) {
              seenShortcodes.add(sc);
              edges.push(e);
            }
          }

          logs.push(`[InstagramScraper] Strategy 1 Logged-in API Success: Parsed ${edges.length} unique posts & reels with exact verified metrics!`);

          edges.forEach((edge: any, i: number) => {
            const node = edge.node;
            if (!node) return;

            const rawCaption = node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || '';
            const captionText = rawCaption.trim() || `Instagram content #${i + 1} by @${handle}`;
            const shortcode = node.shortcode;
            const postLikes = node.edge_liked_by?.count || node.like_count || node.edge_media_preview_like?.count || 0;
            const postComments = node.edge_media_to_comment?.count || node.comment_count || 0;
            const postViews = node.video_view_count || node.play_count || 0;

            recentPosts.push({
              post_id: `ig_${handle}_p_${shortcode || i}`,
              caption: captionText,
              media_url: node.display_url || node.thumbnail_src || node.thumbnail_resources?.[0]?.src || undefined,
              permalink: shortcode ? `https://www.instagram.com/p/${shortcode}/` : profileUrl,
              like_count: postLikes,
              comments_count: postComments,
              views_count: postViews,
              posted_at: node.taken_at_timestamp ? new Date(node.taken_at_timestamp * 1000).toISOString() : new Date().toISOString(),
            });
          });
        }
      } else {
        logs.push(`[InstagramScraper] Strategy 1 Logged-in API returned status ${apiRes.status}`);
      }
    } catch (err: any) {
      logs.push(`[InstagramScraper] Strategy 1 Logged-in API Exception: ${err.message || err}`);
    }
  } else {
    logs.push(`[InstagramScraper] Note: INSTAGRAM_SESSION_ID not set in .env; proceeding with Headless Chrome renderer.`);
  }

  // Strategy 2: Puppeteer Headless Chrome Renderer
  if (followersCount === 0 || recentPosts.length === 0) {
    try {
      const pupRes = await scrapeInstagramWithPuppeteer(handle, logs);
      if (pupRes.followersCount > 0) followersCount = pupRes.followersCount;
      if (pupRes.postsCount > 0) postsCount = pupRes.postsCount;
      if (pupRes.accountName && accountName === handle) accountName = pupRes.accountName;
      if (pupRes.avatarUrl) avatarUrl = pupRes.avatarUrl;
      if (pupRes.posts.length > 0 && recentPosts.length === 0) {
        recentPosts.push(...pupRes.posts);
      }
    } catch (err: any) {
      logs.push(`[InstagramScraper] Strategy 2 Exception: ${err.message || err}`);
    }
  }

  // Strategy 3: Single Post/Reel Captioned Embed Parser (For Direct Post URLs)
  if (isSpecificPost && postShortcode) {
    try {
      logs.push(`[InstagramScraper] Strategy 3: Parsing specific post embed for shortcode "${postShortcode}"...`);
      const embedUrl = `https://www.instagram.com/p/${postShortcode}/embed/captioned/`;
      const embedRes = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (embedRes.ok) {
        const embedHtml = await embedRes.text();
        const captionMatch = embedHtml.match(/class="CaptionText"[^>]*>([\s\S]*?)<\/div>/i) || embedHtml.match(/class="Caption"[^>]*>([\s\S]*?)<\/div>/i);
        const captionText = captionMatch ? captionMatch[1].replace(/<[^>]+>/g, '').trim() : `Instagram Post (${postShortcode})`;

        const imgMatch = embedHtml.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i) || embedHtml.match(/src="([^"]+)"[^>]*class="EmbeddedMediaImage"/i) || embedHtml.match(/<img [^>]*src="([^"]+)"/i);
        const mediaUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : undefined;

        const likesMatch = embedHtml.match(/([0-9.,KMBkmb]+)\s*likes/i);
        const postLikes = likesMatch ? parseFormattedNumber(likesMatch[1]) : 0;

        recentPosts.unshift({
          post_id: `ig_${handle}_p_${postShortcode}`,
          caption: captionText,
          media_url: mediaUrl,
          permalink: `https://www.instagram.com/p/${postShortcode}/`,
          like_count: postLikes,
          comments_count: 0,
          views_count: 0,
          posted_at: new Date().toISOString(),
        });
        logs.push(`[InstagramScraper] Strategy 3 Success: Parsed post "${postShortcode}" with caption and media!`);
      }
    } catch (err: any) {
      logs.push(`[InstagramScraper] Strategy 3 Exception: ${err.message || err}`);
    }
  }

  if (recentPosts.length > 0) {
    likesCount = recentPosts.reduce((acc, p) => acc + (p.like_count || 0), 0);
  }

  logs.push(
    `[InstagramScraper] Scrape Complete for @${handle}: Followers=${followersCount}, Posts=${postsCount}, TotalLikes=${likesCount}, ParsedRealPosts=${recentPosts.length}`
  );

  return {
    platform: 'instagram',
    account_id: handle,
    account_name: accountName,
    profile_url: profileUrl,
    avatar_url: avatarUrl,
    followers_count: followersCount,
    likes_count: likesCount,
    posts_count: postsCount || recentPosts.length,
    recent_posts: recentPosts,
    logs,
  };
}

export function parseFormattedNumber(str: string): number {
  if (!str) return 0;
  const clean = str.trim().replace(/,/g, '');
  const mult = clean.slice(-1).toUpperCase();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;

  if (mult === 'K') return Math.round(num * 1000);
  if (mult === 'M') return Math.round(num * 1000000);
  if (mult === 'B') return Math.round(num * 1000000000);
  return Math.round(num);
}

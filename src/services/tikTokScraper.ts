import { ScrapedSocialProfile, ScrapedSocialPost, parseFormattedNumber } from './instagramScraper';
import puppeteer from 'puppeteer-core';
import fs from 'fs';

export async function scrapeTikTokWithPuppeteer(
  handle: string,
  logs: string[]
): Promise<{ followersCount: number; likesCount: number; accountName: string; avatarUrl: string; posts: ScrapedSocialPost[] }> {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    logs.push(`[TikTokScraper] Chrome executable not found at ${chromePath}`);
    return { followersCount: 0, likesCount: 0, accountName: `@${handle}`, avatarUrl: `https://unavatar.io/tiktok/${handle}`, posts: [] };
  }

  let browser;
  try {
    logs.push(`[TikTokScraper] Launching Puppeteer for TikTok mobile viewport...`);
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty((globalThis as any).navigator, 'webdriver', { get: () => undefined });
    });

    const profileUrl = `https://www.tiktok.com/@${handle}`;
    logs.push(`[TikTokScraper] Puppeteer navigating to ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    await new Promise((r) => setTimeout(r, 4000));

    const pageTitle = await page.title();
    let accountName = `@${handle}`;
    if (pageTitle && pageTitle.includes('TikTok')) {
      accountName = pageTitle.split('|')[0].replace('TikTok', '').trim() || `@${handle}`;
    }

    const data = await page.evaluate((targetHandle: string) => {
      const doc = (globalThis as any).document;
      const links = Array.from(doc.querySelectorAll('a[href*="/video/"]'));
      const posts: any[] = [];
      const seenLinks = new Set<string>();

      links.forEach((aEl: any, i: number) => {
        const href = aEl.getAttribute('href') || '';
        if (seenLinks.has(href)) return;
        seenLinks.add(href);

        const img = aEl.querySelector('img');
        const mediaUrl = img ? img.getAttribute('src') : undefined;
        const altText = img ? (img.getAttribute('alt') || img.getAttribute('title') || '') : '';
        const caption = altText.trim() || `TikTok Video #${i + 1} by @${targetHandle}`;

        posts.push({
          post_id: `tiktok_${targetHandle}_v_${i + 1}`,
          caption: caption,
          media_url: mediaUrl || undefined,
          permalink: href.startsWith('http') ? href : `https://www.tiktok.com${href}`,
          like_count: 0,
          comments_count: 0,
          views_count: 0,
          posted_at: new Date().toISOString(),
        });
      });

      const text = doc.body?.innerText || '';
      let followers = 0;
      let likes = 0;

      const fM = text.match(/([0-9.,KMBkmb]+)\s*Followers/i);
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

      const lM = text.match(/([0-9.,KMBkmb]+)\s*Likes/i);
      if (lM) {
        const clean = lM[1].replace(/,/g, '');
        const mult = clean.slice(-1).toUpperCase();
        const num = parseFloat(clean);
        if (!isNaN(num)) {
          if (mult === 'K') likes = Math.round(num * 1000);
          else if (mult === 'M') likes = Math.round(num * 1000000);
          else likes = Math.round(num);
        }
      }

      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      return { followers, likes, ogImage, posts };
    }, handle);

    logs.push(`[TikTokScraper] Puppeteer parsed ${data.posts.length} videos, Followers=${data.followers}, Likes=${data.likes}`);

    return {
      followersCount: data.followers,
      likesCount: data.likes,
      accountName,
      avatarUrl: data.ogImage || `https://unavatar.io/tiktok/${handle}`,
      posts: data.posts,
    };
  } catch (err: any) {
    logs.push(`[TikTokScraper] Puppeteer TikTok Exception: ${err.message || err}`);
    return { followersCount: 0, likesCount: 0, accountName: `@${handle}`, avatarUrl: `https://unavatar.io/tiktok/${handle}`, posts: [] };
  } finally {
    if (browser) await browser.close();
  }
}

export async function scrapeTikTokProfile(urlOrHandle: string): Promise<ScrapedSocialProfile> {
  const logs: string[] = [];
  const rawInput = urlOrHandle.trim();
  let handle = rawInput.replace(/^@/, '');

  let isSpecificVideo = false;
  let videoId = '';

  if (handle.includes('tiktok.com/')) {
    const videoMatch = handle.match(/tiktok\.com\/@?([^/]+)\/video\/([0-9]+)/i);
    if (videoMatch) {
      handle = videoMatch[1].replace(/^@/, '');
      videoId = videoMatch[2];
      isSpecificVideo = true;
    } else {
      const match = handle.match(/tiktok\.com\/@?([^/?#]+)/i);
      if (match && match[1]) {
        handle = match[1].replace(/^@/, '');
      }
    }
  }

  const profileUrl = `https://www.tiktok.com/@${handle}`;
  let followersCount = 0;
  let likesCount = 0;
  let videoCount = 0;
  let accountName = `@${handle}`;
  let avatarUrl = `https://unavatar.io/tiktok/${handle}`;
  let videoTitle = '';
  let videoThumbnailUrl = '';
  const recentPosts: ScrapedSocialPost[] = [];

  logs.push(`[TikTokScraper] Target handle: @${handle}${isSpecificVideo ? ` (Video ID: ${videoId})` : ''}`);

  // Strategy 1: Microlink API (High-Availability Cloudflare Bypass Endpoint)
  try {
    const microUrl = `https://api.microlink.io/?url=${encodeURIComponent(profileUrl)}`;
    logs.push(`[TikTokScraper] Attempting Strategy 1: Microlink API (${microUrl})`);

    const res = await fetch(microUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
    });

    logs.push(`[TikTokScraper] Strategy 1 Status: ${res.status}`);

    if (res.ok) {
      const json = (await res.json()) as any;
      const data = json.data;
      if (data) {
        if (data.title) {
          const nameM = data.title.match(/^(.*?)\s*\(@/);
          if (nameM && nameM[1]) {
            accountName = nameM[1].trim();
          }
        }

        if (data.image?.url) {
          avatarUrl = data.image.url;
        }

        const desc = data.description || '';
        const fM = desc.match(/([0-9.,KMBkmb]+)\s*Followers/i) || desc.match(/Followers[^0-9]*([0-9.,KMBkmb]+)/i);
        const lM = desc.match(/([0-9.,KMBkmb]+)\s*Likes/i) || desc.match(/Likes[^0-9]*([0-9.,KMBkmb]+)/i);

        if (fM && fM[1]) {
          followersCount = parseFormattedNumber(fM[1]);
        }
        if (lM && lM[1]) {
          likesCount = parseFormattedNumber(lM[1]);
        }

        logs.push(`[TikTokScraper] Strategy 1 Success: Name="${accountName}", Followers=${followersCount}, Likes=${likesCount}`);
      }
    }
  } catch (err: any) {
    logs.push(`[TikTokScraper] Strategy 1 Exception: ${err.message || err}`);
  }

  // Strategy 2: TikTok Official oEmbed Endpoint (For Author & Video Titles)
  try {
    const targetUrl = isSpecificVideo ? rawInput : profileUrl;
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`;
    logs.push(`[TikTokScraper] Attempting Strategy 2: TikTok oEmbed (${oembedUrl})`);

    const oembedRes = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (oembedRes.ok) {
      const oembedData: any = await oembedRes.json();
      if (oembedData.author_name && accountName === `@${handle}`) {
        accountName = oembedData.author_name;
      }
      if (oembedData.title) {
        videoTitle = oembedData.title;
      }
      if (oembedData.thumbnail_url && !avatarUrl) {
        avatarUrl = oembedData.thumbnail_url;
      }
      videoThumbnailUrl = oembedData.thumbnail_url || videoThumbnailUrl;
      logs.push(`[TikTokScraper] Strategy 2 oEmbed Success: Author="${accountName}", Title="${videoTitle}"`);
    }
  } catch (err: any) {
    logs.push(`[TikTokScraper] Strategy 2 Exception: ${err.message || err}`);
  }

  // Strategy 3: Urlebird Public Mirror Parser (Extracts Video Cards)
  try {
    const mirrorUrl = `https://urlebird.com/user/${handle}/`;
    logs.push(`[TikTokScraper] Attempting Strategy 3: Urlebird Mirror (${mirrorUrl})`);

    const mirrorRes = await fetch(mirrorUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
    });

    if (mirrorRes.ok) {
      const html = await mirrorRes.text();

      const followersM = html.match(/<b>Followers:<\/b>\s*([0-9.,KMBkmb]+)/i) || html.match(/([0-9.,KMBkmb]+)\s*Followers/i);
      if (followersM && followersCount === 0) {
        followersCount = parseFormattedNumber(followersM[1]);
      }

      const likesM = html.match(/<b>Likes:<\/b>\s*([0-9.,KMBkmb]+)/i) || html.match(/([0-9.,KMBkmb]+)\s*Likes/i);
      if (likesM && likesCount === 0) {
        likesCount = parseFormattedNumber(likesM[1]);
      }

      const videoMatches = html.matchAll(/<div class="thumb[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi);
      let vIdx = 0;
      for (const match of videoMatches) {
        const vHtml = match[1];
        const vLink = vHtml.match(/<a href="([^"]+\/video\/([^"]+))"/i);
        const vImg = vHtml.match(/<img [^>]*src="([^"]+)"/i) || vHtml.match(/src="([^"]+)"/i);
        const vViews = vHtml.match(/<span class="views"[^>]*>\s*([0-9.,KMBkmb]+)/i) || vHtml.match(/([0-9.,KMBkmb]+)\s*views/i);
        const altCaption = vHtml.match(/alt="([^"]+)"/i) || vHtml.match(/title="([^"]+)"/i);

        if (vLink) {
          vIdx++;
          const realCaption = altCaption && altCaption[1] ? altCaption[1].trim() : `TikTok Video #${vIdx} by ${accountName}`;
          recentPosts.push({
            post_id: `tiktok_${handle}_v_${vIdx}`,
            caption: realCaption,
            media_url: vImg ? vImg[1] : undefined,
            permalink: vLink[1].startsWith('http') ? vLink[1] : `https://urlebird.com${vLink[1]}`,
            like_count: 0,
            comments_count: 0,
            views_count: vViews ? parseFormattedNumber(vViews[1]) : 0,
            posted_at: new Date().toISOString(),
          });
        }
      }
      logs.push(`[TikTokScraper] Strategy 3 Parsed ${recentPosts.length} videos`);
    }
  } catch (err: any) {
    logs.push(`[TikTokScraper] Strategy 3 Exception: ${err.message || err}`);
  }

  // Strategy 4: Puppeteer Mobile Renderer
  if (followersCount === 0 || recentPosts.length === 0) {
    try {
      logs.push(`[TikTokScraper] Strategy 4: Launching Puppeteer TikTok Renderer...`);
      const pupRes = await scrapeTikTokWithPuppeteer(handle, logs);
      if (pupRes.followersCount > 0) followersCount = pupRes.followersCount;
      if (pupRes.likesCount > 0) likesCount = pupRes.likesCount;
      if (pupRes.accountName && accountName === `@${handle}`) accountName = pupRes.accountName;
      if (pupRes.avatarUrl) avatarUrl = pupRes.avatarUrl;
      if (pupRes.posts.length > 0 && recentPosts.length === 0) {
        recentPosts.push(...pupRes.posts);
      }
    } catch (err: any) {
      logs.push(`[TikTokScraper] Strategy 4 Exception: ${err.message || err}`);
    }
  }

  // Insert specific video item if a video URL was submitted
  if (isSpecificVideo) {
    recentPosts.unshift({
      post_id: `tiktok_${handle}_v_${videoId || Date.now()}`,
      caption: videoTitle || `TikTok Video by ${accountName}`,
      media_url: videoThumbnailUrl || avatarUrl || undefined,
      permalink: rawInput,
      like_count: 0,
      comments_count: 0,
      views_count: 0,
      posted_at: new Date().toISOString(),
    });
  }

  logs.push(
    `[TikTokScraper] Final Verified Scrape Result: Name="${accountName}", Followers=${followersCount}, Likes=${likesCount}, Videos=${recentPosts.length}`
  );

  return {
    platform: 'tiktok',
    account_id: handle,
    account_name: accountName,
    profile_url: profileUrl,
    avatar_url: avatarUrl,
    followers_count: followersCount,
    likes_count: likesCount,
    posts_count: videoCount || recentPosts.length,
    recent_posts: recentPosts,
    logs,
  };
}

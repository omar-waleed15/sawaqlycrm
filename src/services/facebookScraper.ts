import { ScrapedSocialProfile, ScrapedSocialPost, parseFormattedNumber } from './instagramScraper';
import puppeteer from 'puppeteer-core';
import { getChromeExecutablePath } from './chromeLocator';

export async function scrapeFacebookProfile(urlOrHandle: string): Promise<ScrapedSocialProfile> {
  const logs: string[] = [];
  let handle = urlOrHandle.trim();
  if (handle.includes('facebook.com/')) {
    const parts = handle.split('facebook.com/')[1].split('/')[0].split('?')[0];
    handle = parts.replace(/^@/, '');
  } else {
    handle = handle.replace(/^@/, '');
  }

  const profileUrl = `https://www.facebook.com/${handle}`;
  let followersCount = 0;
  let likesCount = 0;
  let accountName = handle;
  let avatarUrl = `https://unavatar.io/facebook/${handle}`;
  const recentPosts: ScrapedSocialPost[] = [];

  logs.push(`[FacebookScraper] Target handle: @${handle}`);

  try {
    logs.push(`[FacebookScraper] Fetching Facebook HTML page (${profileUrl})`);
    const pageRes = await fetch(profileUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    logs.push(`[FacebookScraper] HTTP Status: ${pageRes.status}`);

    if (pageRes.ok) {
      const html = await pageRes.text();

      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
      if (titleMatch && titleMatch[1]) {
        accountName = titleMatch[1].split('|')[0].split('-')[0].trim();
      }

      const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (imgMatch && imgMatch[1]) {
        avatarUrl = imgMatch[1].replace(/&amp;/g, '&');
      }

      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
      if (descMatch && descMatch[1]) {
        const desc = descMatch[1];
        const likesM = desc.match(/([0-9.,KMBkmb]+)\s*likes/i);
        if (likesM) likesCount = parseFormattedNumber(likesM[1]);

        const followersM = desc.match(/([0-9.,KMBkmb]+)\s*followers/i);
        if (followersM) followersCount = parseFormattedNumber(followersM[1]);

        logs.push(`[FacebookScraper] Parsed Likes: ${likesCount}, Followers: ${followersCount}`);
      }
    }
  } catch (err: any) {
    logs.push(`[FacebookScraper] Exception: ${err.message || err}`);
  }

  // Puppeteer fallback for Facebook
  if (followersCount === 0 && likesCount === 0) {
    const chromePath = getChromeExecutablePath();
    if (chromePath) {
      let browser;
      try {
        logs.push(`[FacebookScraper] Launching Puppeteer for Facebook profile (${profileUrl})...`);
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 3000));

        const content = await page.content();
        const fM = content.match(/([0-9.,KMBkmb]+)\s*followers/i);
        if (fM) followersCount = parseFormattedNumber(fM[1]);
        const lM = content.match(/([0-9.,KMBkmb]+)\s*likes/i);
        if (lM) likesCount = parseFormattedNumber(lM[1]);

        logs.push(`[FacebookScraper] Puppeteer parsed Followers=${followersCount}, Likes=${likesCount}`);
      } catch (pErr: any) {
        logs.push(`[FacebookScraper] Puppeteer Exception: ${pErr.message || pErr}`);
      } finally {
        if (browser) await browser.close();
      }
    }
  }

  logs.push(`[FacebookScraper] Final Scrape Result: Followers=${followersCount || likesCount}, Likes=${likesCount}`);

  return {
    platform: 'facebook',
    account_id: handle,
    account_name: accountName,
    profile_url: profileUrl,
    avatar_url: avatarUrl,
    followers_count: followersCount || likesCount,
    likes_count: likesCount,
    posts_count: recentPosts.length,
    recent_posts: recentPosts,
    logs,
  };
}

import { scrapeInstagramProfile, ScrapedSocialProfile } from './instagramScraper';
import { scrapeTikTokProfile } from './tikTokScraper';
import { scrapeFacebookProfile } from './facebookScraper';

export function detectPlatformFromUrl(input: string): 'instagram' | 'tiktok' | 'facebook' {
  const str = input.toLowerCase();
  if (str.includes('instagram.com')) return 'instagram';
  if (str.includes('tiktok.com')) return 'tiktok';
  if (str.includes('facebook.com') || str.includes('fb.com')) return 'facebook';
  return 'instagram'; // Default fallback
}

export async function scrapeSocialProfile(
  platform: 'instagram' | 'tiktok' | 'facebook',
  profileUrlOrHandle: string
): Promise<ScrapedSocialProfile> {
  const normalizedPlatform = platform || detectPlatformFromUrl(profileUrlOrHandle);

  switch (normalizedPlatform) {
    case 'instagram':
      return await scrapeInstagramProfile(profileUrlOrHandle);
    case 'tiktok':
      return await scrapeTikTokProfile(profileUrlOrHandle);
    case 'facebook':
      return await scrapeFacebookProfile(profileUrlOrHandle);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

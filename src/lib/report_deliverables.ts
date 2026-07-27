import { supabaseAdmin } from './supabase';

export interface MonthlyDeliverableCounts {
  num_posts: number;
  num_reels: number;
  num_stories: number;
  num_photos: number;
}

/**
 * Calculates actual uploaded content items for a client in a given month (YYYY-MM)
 * from the Content Hub (contents table).
 */
export async function calculateMonthlyDeliverables(
  clientId: string,
  yearMonth: string
): Promise<MonthlyDeliverableCounts> {
  const result: MonthlyDeliverableCounts = {
    num_posts: 0,
    num_reels: 0,
    num_stories: 0,
    num_photos: 0,
  };

  if (!clientId || !yearMonth) return result;

  try {
    // Determine start and end date for target month YYYY-MM
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month)) return result;

    const startDate = `${yearMonth}-01T00:00:00.000Z`;
    // Last day of month
    const nextMonth = new Date(year, month, 1);
    const endDate = nextMonth.toISOString();

    const { data: contents, error } = await supabaseAdmin
      .from('contents')
      .select('id, content_type, created_at')
      .eq('client_id', clientId)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (error) {
      console.error('Error fetching monthly contents for deliverables:', error.message);
      return result;
    }

    (contents || []).forEach((item: any) => {
      const type = (item.content_type || '').toLowerCase();
      if (type === 'post') result.num_posts++;
      else if (type === 'reel') result.num_reels++;
      else if (type === 'story') result.num_stories++;
      else if (type === 'photo' || type === 'photos') result.num_photos++;
    });

    return result;
  } catch (err) {
    console.error('Failed to calculate monthly deliverables:', err);
    return result;
  }
}

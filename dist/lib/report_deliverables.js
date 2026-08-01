"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMonthlyDeliverables = calculateMonthlyDeliverables;
const supabase_1 = require("./supabase");
/**
 * Calculates actual uploaded content items for a client in a given month (YYYY-MM)
 * from the Content Hub (contents table).
 */
async function calculateMonthlyDeliverables(clientId, yearMonth) {
    const result = {
        num_posts: 0,
        num_reels: 0,
        num_stories: 0,
        num_photos: 0,
    };
    if (!clientId || !yearMonth)
        return result;
    try {
        // Determine start and end date for target month YYYY-MM
        const [yearStr, monthStr] = yearMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        if (isNaN(year) || isNaN(month))
            return result;
        const startDate = `${yearMonth}-01T00:00:00.000Z`;
        // Last day of month
        const nextMonth = new Date(year, month, 1);
        const endDate = nextMonth.toISOString();
        const { data: contents, error } = await supabase_1.supabaseAdmin
            .from('contents')
            .select('id, content_type, created_at')
            .eq('client_id', clientId)
            .gte('created_at', startDate)
            .lt('created_at', endDate);
        if (error) {
            console.error('Error fetching monthly contents for deliverables:', error.message);
            return result;
        }
        (contents || []).forEach((item) => {
            const type = (item.content_type || '').toLowerCase();
            if (type === 'post')
                result.num_posts++;
            else if (type === 'reel')
                result.num_reels++;
            else if (type === 'story')
                result.num_stories++;
            else if (type === 'photo' || type === 'photos')
                result.num_photos++;
        });
        return result;
    }
    catch (err) {
        console.error('Failed to calculate monthly deliverables:', err);
        return result;
    }
}

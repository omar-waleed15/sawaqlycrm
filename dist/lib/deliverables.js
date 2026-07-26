"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateDynamicDeliverables = populateDynamicDeliverables;
const supabase_1 = require("./supabase");
async function populateDynamicDeliverables(clients) {
    if (!clients || clients.length === 0)
        return [];
    const clientIds = clients.map(c => c.id);
    // Fetch all content items uploaded to Content Hub for these clients
    const { data: contents, error } = await supabase_1.supabaseAdmin
        .from('contents')
        .select('id, client_id, content_type')
        .in('client_id', clientIds);
    if (error) {
        console.error('Error fetching contents for deliverables count:', error.message);
        return clients;
    }
    // Initialize counts map
    const countsMap = {};
    clientIds.forEach(cid => {
        countsMap[cid] = { posts: 0, reels: 0, stories: 0, photos: 0, otherDone: false };
    });
    // Calculate counts based on uploaded Content Hub items
    (contents || []).forEach((item) => {
        const cid = item.client_id;
        const type = item.content_type;
        if (countsMap[cid]) {
            if (type === 'post')
                countsMap[cid].posts++;
            else if (type === 'reel')
                countsMap[cid].reels++;
            else if (type === 'story')
                countsMap[cid].stories++;
            else if (type === 'photo' || type === 'photos')
                countsMap[cid].photos++;
            else if (type === 'other')
                countsMap[cid].otherDone = true;
        }
    });
    // Map counts back to client objects
    return clients.map(client => {
        const counts = countsMap[client.id];
        if (counts) {
            return {
                ...client,
                done_posts: counts.posts,
                done_reels: counts.reels,
                done_stories: counts.stories,
                done_photos: counts.photos,
                done_other: counts.otherDone,
            };
        }
        return client;
    });
}

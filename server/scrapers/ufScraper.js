import RSSParser from 'rss-parser';
import { supabase } from '../services/supabase.js';
import { analyzeEvent } from '../services/gemini.js';

const parser = new RSSParser({
  customFields: {
    item: ['description', 'content:encoded', 'location'],
  },
});

const UF_RSS_FEEDS = [
  'https://calendar.ufl.edu/feed.rss',
  'https://events.ufl.edu/?format=rss',
];

function parseEventDate(dateStr) {
  if (!dateStr) return { date: null, time: null };
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return { date: null, time: null };
    const date = d.toISOString().split('T')[0];
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { date, time };
  } catch {
    return { date: null, time: null };
  }
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export async function runUFScraper() {
  let totalInserted = 0;

  for (const feedUrl of UF_RSS_FEEDS) {
    try {
      console.log(`[scraper] Fetching ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);

      for (const item of feed.items || []) {
        const title = item.title?.trim();
        if (!title) continue;

        // Skip if we already have this event (match by title + date)
        const { date, time } = parseEventDate(item.pubDate || item.isoDate);
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('source', 'uf_scraper')
          .eq('title', title)
          .eq('date', date)
          .maybeSingle();

        if (existing) continue;

        const description = stripHtml(item['content:encoded'] || item.contentSnippet || item.content || item.description || '');
        const location_name = item.location || null;

        const eventData = {
          title,
          description: description || null,
          location_name,
          date,
          time,
          source: 'uf_scraper',
        };

        const analysis = await analyzeEvent(eventData);
        eventData.category = analysis.category || 'campus';
        eventData.tags = analysis.tags || [];
        // UF scraper events are trusted; only override to pending if flagged
        eventData.status = analysis.is_inappropriate ? 'pending' : 'approved';
        eventData.flagged = analysis.is_inappropriate || false;

        const { error } = await supabase.from('events').insert([eventData]);
        if (error) {
          console.error(`[scraper] Insert error for "${title}":`, error.message);
        } else {
          totalInserted++;
        }
      }
    } catch (e) {
      console.error(`[scraper] Failed to parse ${feedUrl}:`, e.message);
    }
  }

  console.log(`[scraper] Done — inserted ${totalInserted} new events`);
  return totalInserted;
}

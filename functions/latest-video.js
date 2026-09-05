/**
 * GET /latest-video
 *
 * Fetches the church's YouTube channel RSS feed (no API key required)
 * server-side - avoiding the CORS block that stops browsers fetching
 * YouTube's feed directly - and returns the newest video's title/date.
 *
 * Used by assets/js/main.js to auto-fill the "Preacher of the week"
 * ticker whenever data/announcements.json leaves preacherOfTheWeek.name
 * blank (see README.md, section "Preacher of the week - auto mode").
 *
 * Cloudflare Pages picks this up automatically from its path under
 * /functions - no build step or extra deploy config needed.
 */

const CHANNEL_ID = "UCzC7-EtcrU1fCHH7T1yclyw";

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function onRequestGet() {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  try {
    const res = await fetch(feedUrl, {
      cf: { cacheTtl: 900, cacheEverything: true },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CTCT-site/1.0)" },
    });
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    const xml = await res.text();

    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) throw new Error("no entries in feed");
    const entry = entryMatch[1];

    const title = decodeEntities(
      (entry.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1]
    );
    const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [, ""])[1];
    const videoId = (entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/) || [, ""])[1];

    return new Response(
      JSON.stringify({
        title,
        published,
        videoId,
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=900",
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "unavailable" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

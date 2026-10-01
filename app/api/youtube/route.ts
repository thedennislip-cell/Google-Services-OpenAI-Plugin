import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export async function GET(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube search is not configured yet. Add YOUTUBE_API_KEY in Vercel environment variables and redeploy." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json(
      { error: "Search text must be between 2 and 100 characters." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const shortsOnly = url.searchParams.get("shorts") === "true";
  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    type: "video",
    maxResults: "12",
    safeSearch: "moderate",
    ...(shortsOnly ? { videoDuration: "short" } : {}),
    q: query,
  });

  try {
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const data = await response.json();

    if (!response.ok) {
      const reason = data?.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        return NextResponse.json({ error: "YouTube search has reached its API quota for now. Try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } });
      }
      if (reason === "keyInvalid" || reason === "accessNotConfigured" || response.status === 403) {
        return NextResponse.json({ error: "YouTube search is not configured correctly. Check that the API key is valid and YouTube Data API v3 is enabled in Google Cloud." }, { status: 502, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ error: "YouTube could not complete the search. Please try again." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const videos = (Array.isArray(data.items) ? data.items : []).flatMap((item: any) => {
      const id = item?.id?.videoId;
      const snippet = item?.snippet;
      if (typeof id !== "string" || !VIDEO_ID_PATTERN.test(id) || !snippet) return [];
      const thumbnail = snippet.thumbnails?.medium?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url;
      if (typeof thumbnail !== "string" || !thumbnail.startsWith("https://")) return [];
      return [{
        id,
        title: String(snippet.title || "Untitled video"),
        channelTitle: String(snippet.channelTitle || "Unknown channel"),
        description: String(snippet.description || ""),
        thumbnail,
        publishedAt: String(snippet.publishedAt || ""),
      }];
    });

    return NextResponse.json({ videos }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach YouTube right now. Please try again." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

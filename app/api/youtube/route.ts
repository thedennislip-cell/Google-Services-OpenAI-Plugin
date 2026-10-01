import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        medium?: { url?: string };
        high?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  error?: { errors?: Array<{ reason?: string }>; message?: string };
};

export async function GET(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube search is not configured yet. Add YOUTUBE_API_KEY in Vercel and redeploy." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  if (q.length < 2) {
    return NextResponse.json(
      { error: "Enter at least two characters to search." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "12",
    safeSearch: "moderate",
    q,
    key: apiKey
  });

  try {
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), {
      cache: "no-store"
    });
    const data = await response.json() as YouTubeSearchResponse;

    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        return NextResponse.json(
          { error: "YouTube search has reached its daily API quota. Try again later." },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        );
      }
      console.error("YouTube API request failed:", response.status, reason || "unknown");
      return NextResponse.json(
        { error: "YouTube search is temporarily unavailable. Check the API key and YouTube Data API v3 setup." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const videos = (data.items || []).flatMap(item => {
      const id = item.id?.videoId;
      const snippet = item.snippet;
      if (!id || !snippet) return [];
      const thumbnail = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url;
      if (!thumbnail) return [];
      return [{
        id,
        title: snippet.title || "Untitled video",
        description: snippet.description || "",
        channelTitle: snippet.channelTitle || "Unknown channel",
        publishedAt: snippet.publishedAt || "",
        thumbnail
      }];
    });

    return NextResponse.json({ videos }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach YouTube right now. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

"use client";

import { useCallback, useEffect, useState } from "react";

type Mail = { id: string; from: string; subject: string; date: string; snippet: string };
type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string; size?: string };
type YouTubeVideo = { id: string; title: string; channelTitle: string; description: string; thumbnail: string; publishedAt: string };

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<"overview" | "gmail" | "drive" | "youtube" | "shorts" | "privacy">("overview");
  const [mail, setMail] = useState<Mail[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [mailQuery, setMailQuery] = useState("");
  const [driveQuery, setDriveQuery] = useState("");
  const [youtubeQuery, setYoutubeQuery] = useState("");
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [shortsQuery, setShortsQuery] = useState("trending shorts");
  const [shortsVideos, setShortsVideos] = useState<YouTubeVideo[]>([]);
  const [activeShortIndex, setActiveShortIndex] = useState(0);
  const [loadingMoreShorts, setLoadingMoreShorts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const data = await response.json();
      setConnected(Boolean(data.connected));
    } catch { setConnected(false); }
    setChecking(false);
  }, []);

  useEffect(() => {
    refreshStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setNotice("Google account connected. Your data is fetched live from Google.");
    if (params.get("error") === "access_denied") setError("You cancelled Google authorization.");
    else if (params.get("error")) setError("Google sign-in did not finish. Check your OAuth and database settings.");
    if (params.get("setup")) setError("Setup is incomplete. Add the required server environment variables and database table first.");
    if (params.toString()) window.history.replaceState({}, "", window.location.pathname);
  }, [refreshStatus]);

  const loadMail = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/gmail?q=" + encodeURIComponent(mailQuery), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Gmail.");
      setMail(data.messages || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load Gmail."); }
    finally { setBusy(false); }
  };

  const loadFiles = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/drive?q=" + encodeURIComponent(driveQuery), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Drive.");
      setFiles(data.files || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load Drive."); }
    finally { setBusy(false); }
  };

  const searchYoutube = async () => {
    const query = youtubeQuery.trim();
    if (query.length < 2) { setError("Enter at least 2 characters to search YouTube."); return; }
    setBusy(true); setError(""); setSelectedVideo(null);
    try {
      const response = await fetch("/api/youtube?q=" + encodeURIComponent(query), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not search YouTube.");
      setYoutubeVideos(data.videos || []);
      if (!(data.videos || []).length) setNotice("No YouTube videos found. Try a different search.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not search YouTube."); }
    finally { setBusy(false); }
  };

  const searchShorts = async (queryOverride?: string) => {
    const query = (queryOverride ?? shortsQuery).trim();
    if (query.length < 2) { setError("Enter at least 2 characters to search Shorts."); return; }
    setShortsQuery(query);
    setBusy(true); setError(""); setNotice("");
    try {
      const orders = ["relevance", "date", "rating", "viewCount"];
      const order = orders[Math.floor(Math.random() * orders.length)];
      const response = await fetch("/api/youtube?q=" + encodeURIComponent(query) + "&shorts=true&order=" + order, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not search Shorts.");
      const videos = (data.videos || []) as YouTubeVideo[];
      for (let i = videos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [videos[i], videos[j]] = [videos[j], videos[i]];
      }
      setShortsVideos(videos);
      setActiveShortIndex(0);
      if (!videos.length) setNotice("No short videos found. Try a different search.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not search Shorts."); }
    finally { setBusy(false); }
  };

  const loadMoreShorts = async () => {
    if (loadingMoreShorts || !shortsVideos.length) return;
    setLoadingMoreShorts(true);
    try {
      const orders = ["relevance", "date", "rating", "viewCount"];
      const order = orders[Math.floor(Math.random() * orders.length)];
      const response = await fetch("/api/youtube?q=" + encodeURIComponent(shortsQuery.trim()) + "&shorts=true&order=" + order, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load more Shorts.");
      const existing = new Set(shortsVideos.map(video => video.id));
      const fresh = ((data.videos || []) as YouTubeVideo[]).filter(video => !existing.has(video.id));
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
      }
      if (fresh.length) setShortsVideos(current => [...current, ...fresh]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load more Shorts."); }
    finally { setLoadingMoreShorts(false); }
  };

  const disconnect = async () => {
    setBusy(true); setError("");
    try {
      await fetch("/api/disconnect", { method: "POST" });
      setConnected(false); setMail([]); setFiles([]);
      setNotice("Google account disconnected and local session cleared.");
      setTab("overview");
    } catch { setError("Could not disconnect cleanly. Please try again."); }
    finally { setBusy(false); }
  };

  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Google Services home"><span className="brandIcon">G</span><span>Google Services<small>MAIL & DRIVE</small></span></a>
      <div className="sideLabel">WORKSPACE</div>
      {(["overview", "gmail", "drive", "youtube", "shorts", "privacy"] as const).map(item => <button key={item} className={"navItem " + (tab === item ? "active" : "")} onClick={() => { setTab(item); if (item === "shorts" && !shortsVideos.length && !busy) searchShorts("trending shorts"); }}>
        <span className="navIcon">{item === "overview" ? "◫" : item === "gmail" ? "✉" : item === "drive" ? "▱" : item === "youtube" ? "▶" : item === "shorts" ? "▮" : "◇"}</span>
        {item === "overview" ? "Overview" : item === "gmail" ? "Gmail" : item === "drive" ? "Google Drive" : item === "youtube" ? "YouTube" : item === "shorts" ? "Shorts" : "Privacy & security"}
        {item === "gmail" || item === "drive" ? <span className="navLock">•</span> : null}
      </button>)}
      <div className="sidebarBottom"><span className={"statusDot " + (connected ? "green" : "")}/>{connected ? "Google connected" : "Not connected"}<small>Private session</small></div>
    </aside>

    <section className="mainArea">
      <header className="topbar"><div className="mobileBrand"><span className="brandIcon">G</span> Google Services</div><div className="breadcrumb">Personal workspace <span>/</span> {tab === "overview" ? "Overview" : tab === "gmail" ? "Gmail" : tab === "drive" ? "Google Drive" : tab === "youtube" ? "YouTube" : tab === "shorts" ? "Shorts" : "Privacy & security"}</div><div className="topRight"><span className={"pill " + (connected ? "pillGreen" : "")}><i/> {connected ? "Connected" : "Not connected"}</span><div className="avatar">D</div></div></header>

      <div className="content">
        {notice && <div className="notice"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="errorBox"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}

        {tab === "overview" && <>
          <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
          <div className="heroTitle">Everything important,<br/><em>in one calm place.</em></div>
          <p className="heroCopy">A simple, private dashboard for your Gmail and Google Drive. Your Google account stays yours — connect only when you’re ready.</p>
          <div className="heroActions">{connected ? <button className="button buttonPrimary" onClick={() => setTab("gmail")}>Open Gmail <span>↗</span></button> : <a className="button buttonPrimary" href="/api/auth/google">Connect Google account <span>↗</span></a>}<button className="button buttonSecondary" onClick={() => setTab("privacy")}>How privacy works</button></div>
          <div className="statsGrid">
            <article className="statCard"><div className="statTop"><span className="productIcon mailIcon">✉</span><span className={"miniStatus " + (connected ? "miniGreen" : "")}>{connected ? "READY" : "WAITING"}</span></div><h2>Gmail</h2><p>Search and read your messages.</p><button className="textLink" onClick={() => setTab("gmail")}>Open inbox <span>→</span></button></article>
            <article className="statCard"><div className="statTop"><span className="productIcon driveIcon">△</span><span className={"miniStatus " + (connected ? "miniGreen" : "")}>{connected ? "READY" : "WAITING"}</span></div><h2>Google Drive</h2><p>Find files and view their details.</p><button className="textLink" onClick={() => setTab("drive")}>Browse files <span>→</span></button></article>
            <article className="statCard youtubeStatCard"><div className="statTop"><span className="productIcon youtubeIcon">▶</span><span className="miniStatus miniGreen">SEARCH</span></div><h2>YouTube</h2><p>Search videos and watch in your workspace.</p><button className="textLink" onClick={() => setTab("youtube")}>Find videos <span>→</span></button></article>
            <article className="statCard securityCard"><div className="statTop"><span className="productIcon securityIcon">◇</span><span className="miniStatus miniGreen">PRIVATE</span></div><h2>Privacy first</h2><p>Tokens stay encrypted on the server.</p><button className="textLink" onClick={() => setTab("privacy")}>View protections <span>→</span></button></article>
          </div>
          <section className="setupPanel"><div className="panelHeading"><div><div className="eyebrow">GETTING STARTED</div><h2>Connect in a few steps</h2></div><span className="stepCount">{connected ? "3 / 3" : "0 / 3"}</span></div>
            <div className="setupStep"><span className={"stepNum " + (connected ? "stepDone" : "")}>{connected ? "✓" : "01"}</span><div><strong>Create OAuth credentials</strong><p>In Google Cloud, create a Web application OAuth client.</p></div><span className="stepTag">{connected ? "DONE" : "REQUIRED"}</span></div>
            <div className="setupStep"><span className={"stepNum " + (connected ? "stepDone" : "")}>{connected ? "✓" : "02"}</span><div><strong>Configure server secrets and database</strong><p>Add the required environment variables in your hosting dashboard.</p></div><span className="stepTag">{connected ? "DONE" : "REQUIRED"}</span></div>
            <div className="setupStep"><span className={"stepNum " + (connected ? "stepDone" : "")}>{connected ? "✓" : "03"}</span><div><strong>Approve the requested access</strong><p>Google will ask permission to read Gmail and list Drive metadata.</p></div><span className="stepTag">{connected ? "DONE" : "REQUIRED"}</span></div>
          </section>
        </>}

        {tab === "gmail" && <section className="dataPage"><div className="eyebrow">YOUR MESSAGES</div><h1>Gmail <em>inbox</em></h1><p className="pageCopy">Read-only access. Search your mail and open the original message in Gmail.</p>
          {!connected ? <div className="emptyState"><span className="emptyIcon">✉</span><h2>Connect Google to see your mail</h2><p>No sample messages are shown. Once you authorize access, your real Gmail results will appear here.</p><a className="button buttonPrimary" href="/api/auth/google">Connect Google</a></div> : <><form className="searchBar" onSubmit={e => { e.preventDefault(); loadMail(); }}><span>⌕</span><input value={mailQuery} onChange={e => setMailQuery(e.target.value)} placeholder="Search your Gmail…" /><button type="submit">Search</button></form><div className="dataList">{mail.map(m => <article className="mailRow" key={m.id}><div className="mailAvatar">{(m.from || "?").replace(/<.*?>/g, "").trim().slice(0,1).toUpperCase()}</div><div className="mailText"><strong>{m.subject}</strong><span>{m.from}</span><p>{m.snippet}</p></div><time>{m.date}</time></article>)}{!mail.length && <div className="listHint">{busy ? "Loading your messages…" : "Search your Gmail to load messages."}</div>}</div><button className="button buttonSecondary" onClick={loadMail} disabled={busy}>{busy ? "Loading…" : "Load recent messages"}</button></>}
        </section>}

        {tab === "drive" && <section className="dataPage"><div className="eyebrow">YOUR FILES</div><h1>Google <em>Drive</em></h1><p className="pageCopy">Search file names and view metadata. This app won’t edit, delete, or change sharing settings.</p>
          {!connected ? <div className="emptyState"><span className="emptyIcon driveEmpty">△</span><h2>Connect Google to see your files</h2><p>No sample files are shown. Your real Drive file list will appear after you authorize access.</p><a className="button buttonPrimary" href="/api/auth/google">Connect Google</a></div> : <><form className="searchBar" onSubmit={e => { e.preventDefault(); loadFiles(); }}><span>⌕</span><input value={driveQuery} onChange={e => setDriveQuery(e.target.value)} placeholder="Search file names…" /><button type="submit">Search</button></form><div className="fileList">{files.map(f => <a className="fileRow" key={f.id} href={f.webViewLink || "#"} target="_blank" rel="noreferrer"><span className="fileIcon">▤</span><span className="fileText"><strong>{f.name}</strong><small>{f.mimeType}</small></span><time>{f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""}</time><span>↗</span></a>)}{!files.length && <div className="listHint">{busy ? "Loading your files…" : "Search Drive to load files."}</div>}</div><button className="button buttonSecondary" onClick={loadFiles} disabled={busy}>{busy ? "Loading…" : "Load recent files"}</button></>}
        </section>}

        {tab === "youtube" && <section className="dataPage youtubePage"><div className="eyebrow">VIDEO DISCOVERY</div><h1>Explore <em>YouTube.</em></h1><p className="pageCopy">Search public YouTube videos and play supported videos here. YouTube search does not need you to connect your Google account.</p>
          <form className="searchBar" onSubmit={e => { e.preventDefault(); searchYoutube(); }}><span>⌕</span><input value={youtubeQuery} onChange={e => setYoutubeQuery(e.target.value)} placeholder="Search videos, creators, topics…" aria-label="Search YouTube videos" /><button type="submit" disabled={busy}>{busy ? "Searching…" : "Search"}</button></form>
          {selectedVideo && <section className="youtubePlayerPanel"><div className="youtubePlayer"><iframe src={"https://www.youtube-nocookie.com/embed/" + selectedVideo.id + "?rel=0"} title={selectedVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div><div className="youtubeNowPlaying"><div><h2>{selectedVideo.title}</h2><p>{selectedVideo.channelTitle}</p></div><a className="textLink" href={"https://www.youtube.com/watch?v=" + selectedVideo.id} target="_blank" rel="noreferrer">Open on YouTube ↗</a></div></section>}
          <div className="youtubeResultsHeading"><h2>{youtubeVideos.length ? "Search results" : "Find something to watch"}</h2><span>{youtubeVideos.length ? `${youtubeVideos.length} videos` : "Search public videos"}</span></div>
          {youtubeVideos.length ? <div className="youtubeResults">{youtubeVideos.map(video => <button type="button" className={"youtubeVideoCard " + (selectedVideo?.id === video.id ? "selected" : "")} key={video.id} onClick={() => setSelectedVideo(video)}><span className="youtubeThumbWrap"><img src={video.thumbnail} alt="" className="youtubeThumb" loading="lazy" /><span className="youtubePlayBadge">▶</span></span><span className="youtubeVideoInfo"><strong>{video.title}</strong><small>{video.channelTitle}</small><small>{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : ""}</small></span></button>)}</div> : <div className="emptyState youtubeEmpty"><span className="emptyIcon youtubeEmptyIcon">▶</span><h2>Search the YouTube library</h2><p>Enter a topic, video title, or channel above. Choose a result to load the embedded player.</p></div>}
          <p className="finePrint">Some videos disable embedding or may be restricted by their owner, region, or network. If playback is unavailable, use “Open on YouTube.”</p>
        </section>}


        {tab === "shorts" && <section className="dataPage shortsPage"><div className="shortsHeader"><div><div className="eyebrow">PERSONAL DISCOVERY</div><h1>Shorts <em>feed.</em></h1><p className="pageCopy">Scroll vertically to discover another short video. Results are shuffled from YouTube search, not your personal YouTube recommendations.</p></div><form className="shortsSearchBar" onSubmit={e => { e.preventDefault(); searchShorts(); }}><input value={shortsQuery} onChange={e => setShortsQuery(e.target.value)} placeholder="Search a topic…" aria-label="Search Shorts" /><button type="submit" disabled={busy}>{busy ? "Loading…" : "Explore"}</button></form></div>
          {shortsVideos.length ? <div className="shortsFeed" onScroll={e => { const el = e.currentTarget; const nextIndex = Math.round(el.scrollTop / el.clientHeight); setActiveShortIndex(current => current === nextIndex ? current : nextIndex); if (nextIndex >= shortsVideos.length - 3) void loadMoreShorts(); }} aria-label="Scrollable YouTube Shorts feed">
            {shortsVideos.map((video, index) => <article className="shortsFeedSlide" key={video.id}>
              <div className="shortsFeedPlayer">{index === activeShortIndex ? <iframe src={"https://www.youtube-nocookie.com/embed/" + video.id + "?autoplay=1&mute=1&playsinline=1&controls=1&rel=0"} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <button type="button" className="shortsPoster" onClick={() => setActiveShortIndex(index)} aria-label={"Play " + video.title}><img src={video.thumbnail} alt="" loading="lazy" /><span>▶</span></button>}</div>
              <div className="shortsFeedInfo"><span className="shortsFeedCount">{index + 1} / {shortsVideos.length}</span><h2>{video.title}</h2><p>{video.channelTitle}</p><a href={"https://www.youtube.com/shorts/" + video.id} target="_blank" rel="noreferrer">Open on YouTube ↗</a></div>
            </article>)}
            {loadingMoreShorts && <div className="shortsLoadingMore">Finding more videos…</div>}
          </div> : <div className="emptyState youtubeEmpty"><span className="emptyIcon youtubeEmptyIcon">▮</span><h2>{busy ? "Finding Shorts…" : "Discover short videos"}</h2><p>{busy ? "Loading a feed for you." : "Search for a topic above to start scrolling."}</p>{!busy && <button className="button buttonPrimary" onClick={() => searchShorts("trending shorts")}>Load trending Shorts</button>}</div>}
          <p className="finePrint">The public YouTube Data API cannot provide YouTube’s personalized Shorts algorithm or identify official Shorts reliably. These are shuffled short-duration videos (under 4 minutes); some may not be Shorts, and some videos may block embedded playback. Autoplay depends on your browser settings.</p>
        </section>}

        {tab === "privacy" && <section className="dataPage"><div className="eyebrow">BUILT AROUND TRUST</div><h1>Your data, <em>your call.</em></h1><p className="pageCopy">Google Services uses Google’s consent screen. It cannot access your account until you approve it.</p><div className="privacyGrid"><article><span className="privacyIcon">⌑</span><h2>Encrypted credentials</h2><p>OAuth tokens are encrypted with AES-256-GCM before server-side database storage. Encryption keys and database service credentials belong in server environment variables only.</p></article><article><span className="privacyIcon">◉</span><h2>Limited permissions</h2><p>The app requests Gmail read-only and Drive metadata read-only access. It does not send email, delete files, or change Drive sharing.</p></article><article><span className="privacyIcon">↗</span><h2>Disconnect anytime</h2><p>Disconnect clears this app’s stored session and asks Google to revoke its token. You can also review connected apps in your Google Account.</p></article><article><span className="privacyIcon">◎</span><h2>No fake data</h2><p>When disconnected, the app shows setup guidance instead of example emails or files. Results come from Google APIs after authorization.</p></article></div>{connected && <button className="button buttonDanger" onClick={disconnect} disabled={busy}>{busy ? "Disconnecting…" : "Disconnect Google account"}</button>}<p className="finePrint">If Google Workspace says access is blocked by an administrator, this app cannot override that policy.</p></section>}
        <footer className="footer"><span>Google Services</span><span>Private by design · Read-only access</span></footer>
      </div>
    </section>
  </main>;
}

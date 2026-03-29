Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // ─── /raw — ver el m3u8 sin reescribir ───────────────────────────────────
  if (url.pathname === "/raw") {
    const channelId = url.searchParams.get("id") ?? "626c2ed933a2890007e91422";
    const { cfdUrl, sid } = await getSession(channelId);
    const r = await fetch(cfdUrl, { headers: plutoHeaders() });
    const txt = await r.text();
    return new Response(`STATUS: ${r.status}\nURL: ${cfdUrl}\nSID: ${sid.slice(0,40)}...\n\n${txt}`, {
      headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" },
    });
  }

  // ─── PROXY ───────────────────────────────────────────────────────────────
  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) return new Response("Falta url", { status: 400 });

    const r = await fetch(target, { headers: plutoHeaders() });
    const ct = r.headers.get("Content-Type") ?? "";

    if (ct.includes("mpegurl") || target.includes(".m3u8")) {
      const text = await r.text();
      const base = target.substring(0, target.lastIndexOf("/") + 1);
      const fixed = rewriteM3u8(text, base, url.origin);
      return new Response(fixed, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Segmento binario — pass-through
    return new Response(r.body, {
      status: r.status,
      headers: {
        "Content-Type": ct || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  // ─── CANAL PRINCIPAL ─────────────────────────────────────────────────────
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);
  if (!match) {
    return new Response("Uso: /pluto/{id}.m3u8  |  /raw?id={id}", {
      status: 400, headers: { "Content-Type": "text/plain" },
    });
  }

  const channelId = match[1];
  const { cfdUrl } = await getSession(channelId);

  const upstream = await fetch(cfdUrl, { headers: plutoHeaders() });

  if (!upstream.ok) {
    const txt = await upstream.text();
    return new Response(`Error ${upstream.status}:\n${txt}\n\nURL:\n${cfdUrl}`, {
      status: upstream.status,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const m3u8 = await upstream.text();
  const base = cfdUrl.substring(0, cfdUrl.lastIndexOf("/") + 1);
  const fixed = rewriteM3u8(m3u8, base, url.origin);

  return new Response(fixed, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store",
    },
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSession(channelId: string) {
  const clientID = crypto.randomUUID();
  const sessionID = crypto.randomUUID();

  const bootRes = await fetch(
    `https://boot.pluto.tv/v4/start` +
    `?appName=web&appVersion=9.19.0&deviceVersion=130.0.0` +
    `&deviceModel=web&deviceMake=chrome&deviceType=web` +
    `&clientID=${clientID}&clientModelNumber=1.0.0` +
    `&serverSideAds=false&country=US&marketingRegion=US` +
    `&sessionID=${sessionID}&clientTime=${new Date().toISOString()}`,
    { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json", "Origin": "https://pluto.tv" } }
  );

  const boot = await bootRes.json();
  const sid: string = boot?.sessionToken ?? sessionID;
  // stitcherParams ya incluye sid, deviceId, lat, lon, country, etc.
  const sp: string = boot?.stitcherParams ?? "";

  const cfdUrl =
    `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/${channelId}/master.m3u8` +
    `?${sp}&jwt=${encodeURIComponent(sid)}`;

  return { cfdUrl, sid, stitcherParams: sp };
}

function plutoHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Origin": "https://pluto.tv",
    "Referer": "https://pluto.tv/",
  };
}

function rewriteM3u8(text: string, base: string, origin: string): string {
  return text.split("\n").map((line) => {
    const t = line.trim();

    // Reescribir URI="" dentro de tags EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA, etc.
    if (t.startsWith("#") && t.includes('URI="')) {
      return t.replace(/URI="([^"]+)"/g, (_, u) => {
        const abs = u.startsWith("http") ? u : base + u;
        return `URI="${origin}/proxy?url=${encodeURIComponent(abs)}"`;
      });
    }

    if (!t || t.startsWith("#")) return line;

    // Línea de URL (sub-playlist o segmento)
    const abs = t.startsWith("http") ? t : base + t;
    return `${origin}/proxy?url=${encodeURIComponent(abs)}`;
  }).join("\n");
}

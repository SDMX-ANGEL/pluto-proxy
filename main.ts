Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // ─── PROXY ───────────────────────────────────────────────────────────────
  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) return new Response("Falta url", { status: 400 });

    const r = await fetch(target, { headers: plutoHeaders() });
    const ct = r.headers.get("Content-Type") ?? "";

    if (ct.includes("mpegurl") || target.includes(".m3u8")) {
      const text = await r.text();
      // Base = todo hasta el último "/" antes del query string
      const cleanTarget = target.split("?")[0];
      const base = cleanTarget.substring(0, cleanTarget.lastIndexOf("/") + 1);
      // Query string original (sid, deviceId) para preservarlo en sub-URLs
      const qs = target.includes("?") ? "?" + target.split("?")[1] : "";
      const fixed = rewriteM3u8(text, base, qs, url.origin);
      return new Response(fixed, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

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
    return new Response("Uso: /pluto/{channelId}.m3u8", {
      status: 400, headers: { "Content-Type": "text/plain" },
    });
  }

  const channelId = match[1];

  // Boot para obtener sessionToken y stitcherParams
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

  if (!bootRes.ok) {
    return new Response(`Boot error ${bootRes.status}`, { status: 502 });
  }

  const boot = await bootRes.json();
  const sid: string = boot?.sessionToken ?? sessionID;
  const sp: string = boot?.stitcherParams ?? "";

  // URL del master.m3u8 en el stitcher CFD
  const cfdBase = `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/${channelId}/`;
  const cfdUrl = `${cfdBase}master.m3u8?${sp}&jwt=${encodeURIComponent(sid)}`;

  const upstream = await fetch(cfdUrl, { headers: plutoHeaders() });

  if (!upstream.ok) {
    const txt = await upstream.text();
    return new Response(`Pluto error ${upstream.status}:\n${txt}`, {
      status: upstream.status, headers: { "Content-Type": "text/plain" },
    });
  }

  const m3u8 = await upstream.text();
  // El sid y deviceId que vienen en las URLs relativas del master
  const sidParam = `?sid=${encodeURIComponent(sid)}&deviceId=${encodeURIComponent(clientID)}`;
  const fixed = rewriteM3u8(m3u8, cfdBase, sidParam, url.origin);

  return new Response(fixed, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store",
    },
  });
});

function plutoHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Origin": "https://pluto.tv",
    "Referer": "https://pluto.tv/",
  };
}

function rewriteM3u8(text: string, base: string, fallbackQs: string, origin: string): string {
  return text.split("\n").map((line) => {
    const t = line.trim();

    // Reescribir URI="" dentro de tags
    if (t.startsWith("#") && t.includes('URI="')) {
      return t.replace(/URI="([^"]+)"/g, (_, u) => {
        let abs: string;
        if (u.startsWith("http")) {
          abs = u;
        } else if (u.includes("?")) {
          // Ya tiene query string propio (sid, deviceId incluidos)
          abs = base + u;
        } else {
          abs = base + u + fallbackQs;
        }
        return `URI="${origin}/proxy?url=${encodeURIComponent(abs)}"`;
      });
      return t;
    }

    if (!t || t.startsWith("#")) return line;

    // Línea de URL de sub-playlist o segmento
    let abs: string;
    if (t.startsWith("http")) {
      abs = t;
    } else if (t.includes("?")) {
      // Ya tiene query string (sid, deviceId)
      abs = base + t;
    } else {
      abs = base + t + fallbackQs;
    }
    return `${origin}/proxy?url=${encodeURIComponent(abs)}`;
  }).join("\n");
}

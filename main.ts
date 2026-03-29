Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) return new Response("Falta url", { status: 400 });

    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/",
      },
    });

    const ct = res.headers.get("Content-Type") ?? "";

    if (ct.includes("mpegurl") || target.includes(".m3u8")) {
      const text = await res.text();
      const base = target.substring(0, target.lastIndexOf("/") + 1);
      const qIdx = target.indexOf("?");
      const query = qIdx !== -1 ? target.substring(qIdx) : "";

      const fixed = text.split("\n").map((line) => {
        const t = line.trim();

        if (t.startsWith("#") && t.includes('URI="')) {
          return t.replace(/URI="([^"]+)"/g, (_, u) => {
            const abs = u.startsWith("http") ? u : base + u + (u.includes("?") ? "" : query);
            return `URI="${url.origin}/proxy?url=${encodeURIComponent(abs)}"`;
          });
        }

        if (!t || t.startsWith("#")) return line;

        const abs = t.startsWith("http") ? t : base + t + (t.includes("?") ? "" : query);
        return `${url.origin}/proxy?url=${encodeURIComponent(abs)}`;
      }).join("\n");

      return new Response(fixed, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": ct || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);
  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const channelId = match[1];

  let stitcherParams = "";
  let sessionToken = "";

  try {
    const clientID = crypto.randomUUID();
    const sessionID = crypto.randomUUID();

    const bootRes = await fetch(
      `https://boot.pluto.tv/v4/start` +
      `?appName=web&appVersion=9.19.0` +
      `&deviceVersion=130.0.0&deviceModel=web` +
      `&deviceMake=chrome&deviceType=web` +
      `&clientID=${clientID}&clientModelNumber=1.0.0` +
      `&serverSideAds=false&country=US` +
      `&marketingRegion=US&sessionID=${sessionID}` +
      `&clientTime=${new Date().toISOString()}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Origin": "https://pluto.tv",
          "Referer": "https://pluto.tv/",
        },
      }
    );

    if (!bootRes.ok) throw new Error(`Boot ${bootRes.status}`);

    const boot = await bootRes.json();
    sessionToken = boot?.sessionToken ?? "";
    stitcherParams = boot?.stitcherParams ?? "";

    if (!stitcherParams) throw new Error("Sin stitcherParams");
  } catch (e) {
    return new Response(`Error boot: ${e}`, { status: 502 });
  }

  const cfdUrl =
    `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/${channelId}/master.m3u8` +
    `?${stitcherParams}` +
    `&jwt=${encodeURIComponent(sessionToken)}`;

  const upstream = await fetch(cfdUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Origin": "https://pluto.tv",
      "Referer": "https://pluto.tv/",
    },
  });

  if (!upstream.ok) {
    const txt = await upstream.text();
    return new Response(`Pluto CFD error ${upstream.status}:\n${txt}`, {
      status: upstream.status,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const m3u8 = await upstream.text();

  const base = `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/${channelId}/`;

  const fixed = m3u8.split("\n").map((line) => {
    const t = line.trim();

    if (t.startsWith("#") && t.includes('URI="')) {
      return t.replace(/URI="([^"]+)"/g, (_, u) => {
        const abs = u.startsWith("http") ? u : base + u;
        return `URI="${url.origin}/proxy?url=${encodeURIComponent(abs)}"`;
      });
    }

    if (!t || t.startsWith("#")) return line;

    const abs = t.startsWith("http") ? t : base + t;
    return `${url.origin}/proxy?url=${encodeURIComponent(abs)}`;
  }).join("\n");

  return new Response(fixed, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store",
    },
  });
});

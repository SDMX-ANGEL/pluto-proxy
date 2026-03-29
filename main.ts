Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  const mainMatch = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);
  if (mainMatch) {
    const channelId = mainMatch[1];

    const sessionID = crypto.randomUUID();
    const clientID = crypto.randomUUID();

    let jwt = "";
    let sid = sessionID;

    try {
      const bootRes = await fetch(
        `https://boot.pluto.tv/v4/start` +
        `?appName=web&appVersion=9.19.0` +
        `&deviceVersion=130.0.0&deviceModel=web` +
        `&deviceMake=chrome&deviceType=web` +
        `&clientID=${clientID}&clientModelNumber=1.0.0` +
        `&serverSideAds=false&country=US` +
        `&marketingRegion=US` +
        `&sessionID=${sessionID}` +
        `&clientTime=${new Date().toISOString()}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Origin": "https://pluto.tv",
            "Referer": "https://pluto.tv/",
          },
        }
      );

      if (bootRes.ok) {
        const boot = await bootRes.json();
        sid = boot?.sessionToken ?? sessionID;
        jwt = boot?.stitcherParams?.jwt ?? boot?.sessionToken ?? sid;
      }
    } catch (_) {
    }

    const plutoUrl =
      `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/${channelId}/master.m3u8` +
      `?appName=web` +
      `&appVersion=9.19.0` +
      `&clientDeviceType=0` +
      `&clientID=${clientID}` +
      `&clientModelNumber=1.0.0` +
      `&country=US` +
      `&deviceDNT=false` +
      `&deviceId=${clientID}` +
      `&deviceLat=40.71` +
      `&deviceLon=-74.00` +
      `&deviceMake=chrome` +
      `&deviceModel=web` +
      `&deviceType=web` +
      `&deviceVersion=130.0.0` +
      `&marketingRegion=US` +
      `&serverSideAds=false` +
      `&sessionID=${sessionID}` +
      `&sid=${encodeURIComponent(sid)}` +
      `&userId=` +
      `&jwt=${encodeURIComponent(jwt)}`;

    const upstream = await fetch(plutoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/",
      },
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      return new Response(
        `Error ${upstream.status} de Pluto TV:\n${txt}\n\nJWT usado: ${jwt.slice(0, 80)}...`,
        { status: upstream.status, headers: { "Content-Type": "text/plain" } }
      );
    }

    const m3u8Text = await upstream.text();

    const baseUrl = `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/${channelId}/`;
    const proxied = rewriteM3u8(m3u8Text, baseUrl, url.origin);

    return new Response(proxied, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store",
      },
    });
  }

  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) return new Response("Falta parámetro url", { status: 400 });

    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/",
      },
    });

    const ct = upstream.headers.get("content-type") ?? "";

    if (ct.includes("mpegurl") || ct.includes("m3u") || target.includes(".m3u8")) {
      const text = await upstream.text();
      const base = new URL("./", target).href;
      const proxied = rewriteM3u8(text, base, url.origin);
      return new Response(proxied, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": ct || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  return new Response(
    "Pluto TV Proxy\nUso: /pluto/{channelId}.m3u8\nEjemplo: /pluto/626c2ed933a2890007e91422.m3u8",
    { status: 400, headers: { "Content-Type": "text/plain" } }
  );
});

function rewriteM3u8(text: string, baseUrl: string, origin: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#") && trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          const abs = uri.startsWith("http") ? uri : baseUrl + uri;
          return `URI="${origin}/proxy?url=${encodeURIComponent(abs)}"`;
        });
      }

      if (trimmed.startsWith("#")) return line;

      const abs = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
      return `${origin}/proxy?url=${encodeURIComponent(abs)}`;
    })
    .join("\n");
}

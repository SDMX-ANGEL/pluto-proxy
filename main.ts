const PLUTO_PARAMS =
  `?deviceType=samsung-tvplus` +
  `&deviceMake=samsung` +
  `&deviceModel=samsung` +
  `&deviceVersion=unknown` +
  `&appVersion=unknown` +
  `&deviceLat=0` +
  `&deviceLon=0` +
  `&deviceDNT=%7BTARGETOPT%7D` +
  `&deviceId=%7BPSID%7D` +
  `&advertisingId=%7BPSID%7D` +
  `&us_privacy=1YNY` +
  `&samsung_app_domain=%7BAPP_DOMAIN%7D` +
  `&samsung_app_name=%7BAPP_NAME%7D` +
  `&profileLimit=` +
  `&profileFloor=` +
  `&embedPartner=samsung-tvplus` +
  `&masterJWTPassthrough=1`;

Deno.serve(async (req) => {
  const url = new URL(req.url);

  const mainMatch = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);
  if (mainMatch) {
    const channelId = mainMatch[1];
    const plutoUrl =
      `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8` +
      PLUTO_PARAMS;

    const upstream = await fetch(plutoUrl, {
      headers: {
        "User-Agent": "PlutoTV/9.0 (SMART-TV; SAMSUNG; SmartTV2022) AppleWebKit/538.1",
        "Accept": "*/*",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/",
      },
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      return new Response(`Pluto error ${upstream.status}: ${txt}`, { status: upstream.status });
    }

    const m3u8Text = await upstream.text();

    const baseUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/`;
    const proxied = rewriteM3u8(m3u8Text, baseUrl, url.origin);

    return new Response(proxied, {
      headers: {
        "Content-Type": "application/x-mpegURL",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) return new Response("Falta url", { status: 400 });

    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "PlutoTV/9.0 (SMART-TV; SAMSUNG; SmartTV2022) AppleWebKit/538.1",
        "Accept": "*/*",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/",
      },
    });

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

    if (contentType.includes("mpegurl") || contentType.includes("m3u")) {
      const text = await upstream.text();
      const base = new URL("./", target).href;
      const proxied = rewriteM3u8(text, base, url.origin);
      return new Response(proxied, {
        headers: {
          "Content-Type": "application/x-mpegURL",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
});

function rewriteM3u8(text: string, baseUrl: string, origin: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;

      let absUrl: string;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        absUrl = trimmed;
      } else {
        absUrl = baseUrl + trimmed;
      }

      return `${origin}/proxy?url=${encodeURIComponent(absUrl)}`;
    })
    .join("\n");
}

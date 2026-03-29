Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-f0-9]+)$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}", { status: 400 });
  }

  const channelId = match[1];

  try {
    const now = new Date().toISOString();

    const apiUrl = `https://api.pluto.tv/v2/channels?channelIds=${channelId}&deviceType=web&deviceMake=web&deviceModel=web&appName=web&appVersion=9.20.0&clientID=abc123&deviceId=abc123&lang=es&serverNow=${encodeURIComponent(now)}`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/"
      },
    });

    if (!res.ok) {
        const errorText = await res.text();
        return new Response(`Error: ${errorText}`, { status: res.status });
    }

    const data = await res.json();
    const channel = Array.isArray(data) ? data[0] : null;
    let streamUrl = channel?.stitched?.urls?.[0]?.url;

    if (!streamUrl) {
      return new Response("Canal no encontrado", { status: 404 });
    }

    if (!streamUrl.includes("deviceModel=")) {
      streamUrl += "&deviceMake=web&deviceModel=web";
    }

    const m3u8Res = await fetch(streamUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://pluto.tv/"
        }
    });

    const m3u8Text = await m3u8Res.text();

    return new Response(m3u8Text, {
        status: 200,
        headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*"
        }
    });

  } catch (e) {
    return new Response("Error: " + (e as Error).message, { status: 500 });
  }
});

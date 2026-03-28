Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-f0-9]+)$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}", { status: 400 });
  }

  const channelId = match[1];

  try {
    const now = new Date();
    const stop = new Date(now.getTime() + 60 * 60 * 1000); // +1 hora
    const start = now.toISOString();
    const stopStr = stop.toISOString();

    const apiUrl = `https://api.pluto.tv/v2/channels?start=${encodeURIComponent(start)}&stop=${encodeURIComponent(stopStr)}&channelIds=${channelId}&deviceType=web&appName=web&appVersion=9.20.0&clientID=abc123&deviceId=abc123&lang=es`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/",
      },
    });

    const data = await res.json();
    const channel = Array.isArray(data) ? data[0] : data?.data?.[0] ?? data;
    const streamUrl =
      channel?.stitched?.urls?.[0]?.url ||
      channel?.streamingUrl ||
      channel?.stitchedUrl;

    if (!streamUrl) {
      return new Response(JSON.stringify(data, null, 2), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return Response.redirect(streamUrl, 302);
  } catch (e) {
    return new Response("Error: " + e.message, { status: 500 });
  }
});

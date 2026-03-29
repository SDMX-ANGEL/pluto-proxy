Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}", { status: 400 });
  }

  const channelId = match[1];

  try {
    const apiUrl = `https://api.pluto.tv/v2/channels?channelIds=${channelId}&deviceType=web&appName=web&appVersion=9.20.0&clientID=abc123&deviceId=abc123&lang=es`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/",
      },
    });

    const data = await res.json();
    const channel = Array.isArray(data) ? data[0] : null;
    let streamUrl = channel?.stitched?.urls?.[0]?.url;

    if (!streamUrl) {
      return new Response("Canal no encontrado", { status: 404 });
    }

    if (!streamUrl.includes("deviceModel")) {
      const separator = streamUrl.includes("?") ? "&" : "?";
      streamUrl += `${separator}deviceModel=web&deviceMake=chrome`;
    }

    return Response.redirect(streamUrl, 302);
  } catch (e) {
    return new Response("Error: " + e.message, { status: 500 });
  }
});

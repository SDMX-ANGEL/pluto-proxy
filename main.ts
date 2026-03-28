Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-f0-9]+)$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}", { status: 400 });
  }

  const channelId = match[1];

  try {
    const res = await fetch(
      `https://api.pluto.tv/v2/channels?start=now&stop=now&channelIds=${channelId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Origin": "https://pluto.tv",
          "Referer": "https://pluto.tv/",
        },
      }
    );

    const data = await res.json();
    const streamUrl = data?.[0]?.stitched?.urls?.[0]?.url;

    if (!streamUrl) {
      return new Response("Stream no encontrado", { status: 502 });
    }

    return Response.redirect(streamUrl, 302);
  } catch (e) {
    return new Response("Error: " + e.message, { status: 500 });
  }
});

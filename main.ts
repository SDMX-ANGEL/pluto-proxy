Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

  try {
    const clientId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();

    const apiUrl = `https://api.pluto.tv/v2/channels?channelIds=${channelId}&deviceType=web&deviceMake=web&deviceModel=web&appName=web&appVersion=9.20.0&clientID=${clientId}&deviceId=${deviceId}`;

    const plutoRes = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    if (!plutoRes.ok) {
        throw new Error(`Pluto rechazó la petición (HTTP ${plutoRes.status})`);
    }

    const data = await plutoRes.json();
    
    if (!data || data.length === 0) {
        throw new Error("Canal no encontrado o bloqueado por región.");
    }

    const streamUrl = data[0]?.stitched?.urls?.[0]?.url;

    if (!streamUrl) {
        throw new Error("Pluto no entregó el enlace de video (.m3u8)");
    }

    return Response.redirect(streamUrl, 302);
    
  } catch (error) {
    return new Response("Error de señal: " + error.message, { 
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
});

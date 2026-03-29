Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

  try {
    const deviceId = crypto.randomUUID();
    const bootUrl = `https://boot.pluto.tv/v4/production/info?appName=web&appVersion=unknown&deviceVersion=unknown&deviceModel=web&deviceMake=unknown&deviceType=web&clientID=${deviceId}`;
    
    // Disfrazamos la petición para que parezca un navegador Chrome en Windows
    const response = await fetch(bootUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/"
      }
    });

    if (!response.ok) {
        return new Response(`Error de seguridad: Pluto TV bloqueó la conexión (HTTP ${response.status})`, { status: 500 });
    }

    const data = await response.json();
    const stitcherParams = data.stitcherParams;

    if (!stitcherParams) {
      // Si no hay token, mostramos la respuesta real de Pluto para ver qué pasó
      return new Response(`Pluto TV no dio el token. Respuesta del servidor: ${JSON.stringify(data)}`, { status: 500 });
    }

    const finalUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8${stitcherParams}`;
    return Response.redirect(finalUrl, 302);

  } catch (error) {
    // @ts-ignore: Para capturar el mensaje de error de Deno
    return new Response(`Error interno de Deno: ${error.message}`, { status: 500 });
  }
});

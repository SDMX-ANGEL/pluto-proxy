Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

  try {
    // 1. Generamos un ID de dispositivo aleatorio para simular un usuario nuevo
    const deviceId = crypto.randomUUID();

    // 2. Le pedimos a la API oficial de Pluto TV los datos de conexión frescos
    const bootUrl = `https://boot.pluto.tv/v4/production/info?appName=web&appVersion=unknown&deviceVersion=unknown&deviceModel=web&deviceMake=unknown&deviceType=web&clientID=${deviceId}`;
    
    const response = await fetch(bootUrl);
    const data = await response.json();

    // 3. Extraemos los parámetros mágicos (esto incluye un token "jwt" recién horneado)
    const stitcherParams = data.stitcherParams;

    if (!stitcherParams) {
      return new Response("Error: Pluto TV no devolvió el token.", { status: 500 });
    }

    // 4. Construimos la URL final uniendo el canal con los parámetros nuevos
    const finalUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8${stitcherParams}`;

    // 5. Hacemos la redirección hacia el video
    return Response.redirect(finalUrl, 302);

  } catch (error) {
    return new Response("Error interno del servidor.", { status: 500 });
  }
});

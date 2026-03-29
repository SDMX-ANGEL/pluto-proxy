Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

  try {
    const authRes = await fetch("https://api.pluto.tv/v3/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: { sdkGuid: crypto.randomUUID() } })
    });

    const authData = await authRes.json();
    const token = authData.jwt; 

    if (!token) throw new Error("No se pudo obtener el token");

    const finalUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&deviceVersion=unknown&appVersion=unknown&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=${token}`;

    return Response.redirect(finalUrl, 302);

  } catch (e) {
    return new Response("Error obteniendo token: " + e.message, { status: 500 });
  }
});

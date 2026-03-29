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
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" 
      },
      body: JSON.stringify({ device: { sdkGuid: crypto.randomUUID() } })
    });
    
    const authData = await authRes.json();
    const freshToken = authData.jwt;

    if (!freshToken) throw new Error("No se pudo obtener el token");

    const plutoSamsungUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&deviceVersion=unknown&appVersion=unknown&deviceLat=0&deviceLon=0&deviceDNT=0&deviceId=0&advertisingId=0&us_privacy=1YNY&samsung_app_domain=0&samsung_app_name=0&profileLimit=&profileFloor=&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=${freshToken}`;

    return Response.redirect(plutoSamsungUrl, 302);
    
  } catch (error) {
    return new Response("Error interno obteniendo la señal", { status: 500 });
  }
});

// Pluto TV proxy — renueva el token Samsung en cada petición
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

  let authToken: string;
  try {
    const tokenRes = await fetch(
      "https://boot.pluto.tv/v4/start?appName=web&appVersion=na&deviceVersion=na&deviceModel=web&deviceMake=chrome&deviceType=web&clientID=na&clientModelNumber=na",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      }
    );

    if (!tokenRes.ok) {
      throw new Error(`Pluto boot falló: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    authToken =
      tokenData?.sessionToken ??
      tokenData?.session?.sessionToken ??
      tokenData?.["user"]?.["session"]?.["token"] ??
      "";

    if (!authToken) {
      throw new Error("No se encontró sessionToken en la respuesta");
    }
  } catch (err) {
    return new Response(`Error obteniendo token: ${err.message}`, {
      status: 502,
    });
  }

  const plutoUrl =
    `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8` +
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
    `&masterJWTPassthrough=1` +
    `&authToken=${encodeURIComponent(authToken)}`;

  return Response.redirect(plutoUrl, 302);
});

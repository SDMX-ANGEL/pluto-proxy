Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

  let clientID: string;
  let sessionToken: string;

  try {
    const uuid = crypto.randomUUID();

    const bootRes = await fetch(
      `https://boot.pluto.tv/v4/start?` +
        `appName=web&appVersion=9.0.0&deviceVersion=130.0.0` +
        `&deviceModel=web&deviceMake=chrome&deviceType=web` +
        `&clientID=${uuid}&clientModelNumber=1.0.0` +
        `&serverSideAds=false&clientTime=${new Date().toISOString()}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Origin": "https://pluto.tv",
          "Referer": "https://pluto.tv/",
        },
      }
    );

    if (!bootRes.ok) {
      const txt = await bootRes.text();
      throw new Error(`Boot falló ${bootRes.status}: ${txt.slice(0, 300)}`);
    }

    const boot = await bootRes.json();
    clientID = boot?.clientID ?? uuid;
    sessionToken = boot?.sessionToken ?? "";

    if (!sessionToken) {
      throw new Error(
        "sessionToken no encontrado. Keys disponibles: " +
          Object.keys(boot ?? {}).join(", ")
      );
    }
  } catch (err) {
    return new Response(`Error obteniendo sesión: ${err.message}`, {
      status: 502,
    });
  }

  const plutoUrl =
    `https://service-stitcher.clusters.pluto.tv/v2/stitch/hls/channel/${channelId}/master.m3u8` +
    `?deviceType=web` +
    `&deviceMake=chrome` +
    `&deviceModel=web` +
    `&deviceVersion=130.0.0` +
    `&appVersion=9.0.0` +
    `&deviceDNT=0` +
    `&deviceId=${encodeURIComponent(clientID)}` +
    `&advertisingId=${encodeURIComponent(clientID)}` +
    `&us_privacy=1YNY` +
    `&sid=${encodeURIComponent(sessionToken)}` +
    `&authToken=${encodeURIComponent(sessionToken)}`;

  return Response.redirect(plutoUrl, 302);
});

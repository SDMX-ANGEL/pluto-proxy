Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

  try {
    // 1. Obtenemos la IP real de quien abre el link (para evitar bloqueos de Deno)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "189.215.50.110";

    // 2. Pedimos el token disfrazados 100% de una TV Samsung
    const authRes = await fetch("https://api.pluto.tv/v3/auth/guest", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.5) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.5 TV Safari/537.36",
        "X-Forwarded-For": clientIp 
      },
      body: JSON.stringify({ 
        device: { 
          sdkGuid: crypto.randomUUID(),
          make: "samsung",
          model: "samsung",
          type: "samsung-tvplus"
        } 
      })
    });
    
    // Si Pluto nos bloquea, capturamos el motivo exacto
    if (!authRes.ok) {
        const errorText = await authRes.text();
        throw new Error(`Pluto rechazó la conexión (HTTP ${authRes.status}): ${errorText.substring(0, 150)}`);
    }

    const authData = await authRes.json();
    const freshToken = authData.jwt;

    if (!freshToken) throw new Error("Pluto no envió el Token JWT");

    // 3. Insertamos el token dinámico en la URL
    const plutoSamsungUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&deviceVersion=unknown&appVersion=unknown&deviceLat=0&deviceLon=0&deviceDNT=0&deviceId=0&advertisingId=0&us_privacy=1YNY&samsung_app_domain=0&samsung_app_name=0&profileLimit=&profileFloor=&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=${freshToken}`;

    // 4. Redirigimos al reproductor
    return Response.redirect(plutoSamsungUrl, 302);
    
  } catch (error) {
    // AHORA SÍ VEREMOS EL ERROR REAL EN PANTALLA
    return new Response("Error interno obteniendo la señal: " + error.message, { 
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
});

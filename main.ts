Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === '/proxy') {
    const target = url.searchParams.get('url');
    if (!target) return new Response("Falta URL", { status: 400 });

    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://pluto.tv/"
        }
      });

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("mpegurl") || target.includes(".m3u8")) {
        const text = await res.text();
        const parsedTarget = new URL(target);
        
        const fixedText = text.split("\n").map(line => {
          const t = line.trim();
          if (t && !t.startsWith("#")) {
            const fullUrl = new URL(t, parsedTarget.href).href;
            return `${url.origin}/proxy?url=${encodeURIComponent(fullUrl)}`;
          }
          return t;
        }).join("\n");

        return new Response(fixedText, { 
          headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" } 
        });
      }

      return new Response(res.body, { 
        headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" } 
      });
    } catch (e) {
      return new Response("Error en el túnel", { status: 500 });
    }
  }

  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);
  if (!match) return new Response("Uso: /pluto/{id}.m3u8", { status: 400 });

  const channelId = match[1];

  try {
    const authRes = await fetch("https://api.pluto.tv/v3/auth/guest", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      body: JSON.stringify({ 
        device: { 
          sdkGuid: crypto.randomUUID(), 
          model: "web",
          make: "web",
          type: "web"
        } 
      })
    });

    const authData = await authRes.json();
    const newToken = authData.jwt; 

    if (!newToken) throw new Error("No se obtuvo token");

    const plutoUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&deviceVersion=unknown&appVersion=unknown&deviceDNT=0&advertisingId=0&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=${newToken}`;

    return Response.redirect(`${url.origin}/proxy?url=${encodeURIComponent(plutoUrl)}`, 302);

  } catch (e) {
    return new Response("Error generando token: " + e.message, { status: 500 });
  }
});

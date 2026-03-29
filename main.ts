Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) return new Response("Uso: /pluto/{id}.m3u8", { status: 400 });

  const channelId = match[1];

  try {
    const authRes = await fetch("https://api.pluto.tv/v3/auth/guest", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (SAMSUNG; SAMSUNG-SM-T500 Build/RP1A.200720.012) AppleWebkit/537.36 (KHTML, like Gecko) SamsungBrowser/13.0 Chrome/83.0.4103.106 Safari/537.36"
      },
      body: JSON.stringify({ 
        device: { 
          sdkGuid: crypto.randomUUID(),
          model: "samsung",
          make: "samsung",
          type: "samsung-tvplus"
        } 
      })
    });

    const { jwt: token } = await authRes.json();

    const finalUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&deviceVersion=unknown&appVersion=unknown&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=${token}`;

    return new Response(null, {
      status: 302,
      headers: {
        "Location": finalUrl,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });

  } catch (e) {
    return new Response("Error: " + e.message, { status: 500 });
  }
});

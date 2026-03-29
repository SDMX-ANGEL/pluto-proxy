Deno.serve(async (req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) return new Response("Uso: /pluto/{id}.m3u8", { status: 400 });

  const channelId = match[1];

  try {
    const authRes = await fetch("https://api.pluto.tv/v3/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: { sdkGuid: crypto.randomUUID() } })
    });
    const { jwt: token } = await authRes.json();

    const finalUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&deviceVersion=unknown&appVersion=unknown&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=${token}`;

    const m3u8Res = await fetch(finalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (SAMSUNG; SAMSUNG-SM-T500 Build/RP1A.200720.012) AppleWebkit/537.36",
        "Referer": "https://pluto.tv/"
      }
    });

    let m3u8Text = await m3u8Res.text();

    const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
    const tokenQuery = finalUrl.substring(finalUrl.indexOf('?'));

    const fixedM3u8 = m3u8Text.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('http')) {
        return baseUrl + trimmed + tokenQuery;
      }
      return trimmed;
    }).join('\n');

    return new Response(fixedM3u8, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });

  } catch (e) {
    return new Response("Error: " + e.message, { status: 500 });
  }
});

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // ─── RUTA DEBUG: ver qué devuelve Pluto TV realmente ─────────────────────
  if (url.pathname === "/debug") {
    const channelId = url.searchParams.get("id") ?? "626c2ed933a2890007e91422";
    const results: Record<string, unknown> = {};

    // Test 1: boot.pluto.tv
    try {
      const uuid = crypto.randomUUID();
      const r = await fetch(
        `https://boot.pluto.tv/v4/start?appName=web&appVersion=9.19.0&deviceVersion=130.0.0` +
        `&deviceModel=web&deviceMake=chrome&deviceType=web&clientID=${uuid}` +
        `&clientModelNumber=1.0.0&serverSideAds=false&country=US`,
        { headers: { "User-Agent": "Mozilla/5.0", "Origin": "https://pluto.tv" } }
      );
      const json = await r.json();
      results["boot_status"] = r.status;
      results["boot_keys"] = Object.keys(json);
      results["sessionToken_preview"] = String(json?.sessionToken ?? "NONE").slice(0, 60);
      results["stitcherParams"] = json?.stitcherParams ?? "NONE";
    } catch (e) { results["boot_error"] = String(e); }

    // Test 2: api.pluto.tv/v3/auth/guest
    try {
      const r = await fetch("https://api.pluto.tv/v3/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "https://pluto.tv" },
        body: JSON.stringify({ device: { sdkGuid: crypto.randomUUID() } }),
      });
      const json = await r.json();
      results["guest_status"] = r.status;
      results["guest_keys"] = Object.keys(json);
      results["guest_jwt_preview"] = String(json?.jwt ?? "NONE").slice(0, 60);
    } catch (e) { results["guest_error"] = String(e); }

    // Test 3: stitcher sin token
    try {
      const r = await fetch(
        `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8` +
        `?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung` +
        `&embedPartner=samsung-tvplus&masterJWTPassthrough=1`,
        { headers: { "User-Agent": "Mozilla/5.0", "Origin": "https://pluto.tv" } }
      );
      const txt = await r.text();
      results["stitcher_notoken_status"] = r.status;
      results["stitcher_notoken_preview"] = txt.slice(0, 200);
    } catch (e) { results["stitcher_notoken_error"] = String(e); }

    // Test 4: stitcher CFD con sessionToken
    try {
      const uuid = crypto.randomUUID();
      const bootR = await fetch(
        `https://boot.pluto.tv/v4/start?appName=web&appVersion=9.19.0&deviceVersion=130.0.0` +
        `&deviceModel=web&deviceMake=chrome&deviceType=web&clientID=${uuid}&clientModelNumber=1.0.0`,
        { headers: { "User-Agent": "Mozilla/5.0", "Origin": "https://pluto.tv" } }
      );
      const boot = await bootR.json();
      const sid = boot?.sessionToken ?? "";
      const r = await fetch(
        `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/v2/stitch/hls/channel/${channelId}/master.m3u8` +
        `?deviceType=web&deviceMake=chrome&deviceModel=web&deviceVersion=130.0.0` +
        `&appVersion=9.19.0&clientID=${uuid}&sid=${encodeURIComponent(sid)}&jwt=${encodeURIComponent(sid)}`,
        { headers: { "User-Agent": "Mozilla/5.0", "Origin": "https://pluto.tv" } }
      );
      const txt = await r.text();
      results["cfd_status"] = r.status;
      results["cfd_preview"] = txt.slice(0, 300);
    } catch (e) { results["cfd_error"] = String(e); }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // ─── RUTA PROXY ──────────────────────────────────────────────────────────
  if (url.pathname === "/proxy") {
    const target = url.searchParams.get("url");
    if (!target) return new Response("Falta url", { status: 400 });
    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Origin": "https://pluto.tv",
          "Referer": "https://pluto.tv/",
        },
      });
      const ct = res.headers.get("Content-Type") ?? "";
      if (ct.includes("mpegurl") || target.includes(".m3u8")) {
        const text = await res.text();
        const base = target.substring(0, target.lastIndexOf("/") + 1);
        const query = target.includes("?") ? target.substring(target.indexOf("?")) : "";
        const fixed = text.split("\n").map((line) => {
          const t = line.trim();
          if (t && !t.startsWith("#")) {
            const full = t.startsWith("http") ? t : base + t + query;
            return `${url.origin}/proxy?url=${encodeURIComponent(full)}`;
          }
          // Reescribir URI="" en tags como EXT-X-KEY
          if (t.startsWith("#") && t.includes('URI="')) {
            return t.replace(/URI="([^"]+)"/g, (_, u) => {
              const full = u.startsWith("http") ? u : base + u;
              return `URI="${url.origin}/proxy?url=${encodeURIComponent(full)}"`;
            });
          }
          return t;
        }).join("\n");
        return new Response(fixed, {
          headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" },
        });
      }
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": ct || "video/mp2t", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return new Response("Proxy error: " + e, { status: 500 });
    }
  }

  // ─── RUTA PRINCIPAL ──────────────────────────────────────────────────────
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);
  if (!match) return new Response(
    "Pluto TV Proxy\nUso: /pluto/{channelId}.m3u8\nDiagnóstico: /debug?id={channelId}",
    { status: 400, headers: { "Content-Type": "text/plain" } }
  );

  const channelId = match[1];
  const uuid = crypto.randomUUID();

  // Paso 1: obtener JWT guest (el más confiable)
  let jwt = "";
  try {
    const guestRes = await fetch("https://api.pluto.tv/v3/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://pluto.tv" },
      body: JSON.stringify({ device: { sdkGuid: uuid } }),
    });
    if (guestRes.ok) {
      const g = await guestRes.json();
      jwt = g?.jwt ?? "";
    }
  } catch (_) {}

  // Paso 2: si no hay JWT guest, usar sessionToken del boot
  let sid = "";
  if (!jwt) {
    try {
      const bootRes = await fetch(
        `https://boot.pluto.tv/v4/start?appName=web&appVersion=9.19.0&deviceVersion=130.0.0` +
        `&deviceModel=web&deviceMake=chrome&deviceType=web&clientID=${uuid}&clientModelNumber=1.0.0`,
        { headers: { "User-Agent": "Mozilla/5.0", "Origin": "https://pluto.tv" } }
      );
      if (bootRes.ok) {
        const b = await bootRes.json();
        sid = b?.sessionToken ?? "";
        jwt = sid;
      }
    } catch (_) {}
  }

  // Paso 3: construir URL stitcher Samsung con JWT guest
  const stitcherUrl =
    `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8` +
    `?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung` +
    `&deviceVersion=unknown&appVersion=unknown` +
    `&deviceLat=0&deviceLon=0` +
    `&deviceDNT=%7BTARGETOPT%7D&deviceId=%7BPSID%7D&advertisingId=%7BPSID%7D` +
    `&us_privacy=1YNY` +
    `&samsung_app_domain=%7BAPP_DOMAIN%7D&samsung_app_name=%7BAPP_NAME%7D` +
    `&embedPartner=samsung-tvplus&masterJWTPassthrough=1` +
    (jwt ? `&authToken=${encodeURIComponent(jwt)}` : "");

  // Paso 4: descargar m3u8 desde el servidor y hacer proxy
  const upstream = await fetch(stitcherUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1",
      "Origin": "https://pluto.tv",
      "Referer": "https://pluto.tv/",
    },
  });

  if (!upstream.ok) {
    const txt = await upstream.text();
    return new Response(
      `Pluto error ${upstream.status}: ${txt}\n\nURL intentada:\n${stitcherUrl}`,
      { status: upstream.status, headers: { "Content-Type": "text/plain" } }
    );
  }

  const m3u8 = await upstream.text();
  const base = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/`;
  const fixed = m3u8.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    const abs = t.startsWith("http") ? t : base + t;
    return `${url.origin}/proxy?url=${encodeURIComponent(abs)}`;
  }).join("\n");

  return new Response(fixed, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    },
  });
});

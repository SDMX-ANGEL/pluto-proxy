Deno.serve(async (req) => {
  const url = new URL(req.url);

  // --- RUTA 1: EL MOTOR PRINCIPAL ---
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)\.m3u8$/i);
  
  if (match) {
    const channelId = match[1];
    
    // Usamos la API de Boot de Pluto (la más permisiva y estable)
    // Inyectamos marketingRegion=MX para forzar el catálogo latino sin importar dónde esté el servidor Deno
    const plutoUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?advertisingId=&appName=web&appVersion=9.20.0&clientDeviceType=0&clientID=${crypto.randomUUID()}&clientModelNumber=1.0.0&country=MX&deviceDNT=false&deviceId=${crypto.randomUUID()}&deviceMake=chrome&deviceModel=web&deviceType=web&deviceVersion=146.0.0&marketingRegion=MX&serverSideAds=false`;

    try {
      // Deno pide el archivo maestro haciéndose pasar por Chrome
      const res = await fetch(plutoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "Referer": "https://pluto.tv/",
          "Origin": "https://pluto.tv"
        }
      });

      if (!res.ok) throw new Error("Pluto bloqueó a Deno");

      let playlistDecodificada = await res.text();

      // INGENIERÍA INVERSA: Reescribimos las URLs internas de Pluto TV 
      // para que apunten a nuestra RUTA 2 (El Túnel). 
      // Así tu emulador nunca toca los servidores de Pluto.
      const proxyUrl = `${url.origin}/tunel?target=`;
      playlistDecodificada = playlistDecodificada.replace(/(https:\/\/.*?\.m3u8.*)/g, `${proxyUrl}${encodeURIComponent("$1")}`);

      return new Response(playlistDecodificada, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*" // Vital para que no haya errores en Flutter
        }
      });
    } catch (e) {
      return new Response("Error en el motor principal", { status: 500 });
    }
  }

  // --- RUTA 2: EL TÚNEL DE INVISIBILIDAD ---
  // Cuando tu app pide un pedazo de video, Deno va, lo busca y se lo trae.
  if (url.pathname === '/tunel') {
    const target = url.searchParams.get('target');
    if (!target) return new Response("URL no válida", { status: 400 });

    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": "https://pluto.tv/"
        }
      });

      // Si es otra lista (m3u8), seguimos reescribiendo
      if (target.includes('.m3u8')) {
        let text = await res.text();
        const baseURL = target.substring(0, target.lastIndexOf('/') + 1);
        
        // Convertimos rutas relativas a absolutas y las pasamos por el túnel
        text = text.split('\n').map(line => {
          if (line.trim() === '' || line.startsWith('#')) return line;
          const absoluteUrl = line.startsWith('http') ? line : baseURL + line;
          return `${url.origin}/tunel?target=${encodeURIComponent(absoluteUrl)}`;
        }).join('\n');

        return new Response(text, {
          headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*" }
        });
      }

      // Si es el segmento de video (.ts), lo dejamos pasar tal cual
      return new Response(res.body, {
        headers: { 
          "Content-Type": res.headers.get("Content-Type") || "video/MP2T",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (e) {
      return new Response("Error en el túnel", { status: 500 });
    }
  }

  return new Response("Servidor DMX ANGEL Activo. Usa /pluto/ID.m3u8", { status: 200 });
});

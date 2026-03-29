Deno.serve(async (req) => {
  const url = new URL(req.url);

  // RUTA 1: EL TÚNEL (Deno descarga y entrega el video para evitar bloqueos)
  if (url.pathname === '/proxy') {
    const target = url.searchParams.get('url');
    if (!target) return new Response("URL faltante", { status: 400 });

    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://pluto.tv/"
        }
      });

      const contentType = res.headers.get("Content-Type") || "";

      // Si es una lista (.m3u8), reescribimos los links internos para que pasen por el túnel
      if (contentType.includes("mpegurl") || target.includes(".m3u8")) {
        const text = await res.text();
        const parsedTarget = new URL(target);
        
        const fixedText = text.split("\n").map(line => {
          const t = line.trim();
          if (t && !t.startsWith("#")) {
            // Resolvemos la URL completa y la mandamos de vuelta a nuestro proxy
            const fullUrl = new URL(t, parsedTarget.href).href;
            return `${url.origin}/proxy?url=${encodeURIComponent(fullUrl)}`;
          }
          return t;
        }).join("\n");

        return new Response(fixedText, { 
          headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" } 
        });
      }

      // Si es video (.ts), lo pasamos bit a bit (Streaming puro)
      return new Response(res.body, { 
        headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" } 
      });
    } catch (e) {
      return new Response("Error en el túnel", { status: 500 });
    }
  }

  // RUTA 2: EL GENERADOR (Recibe el ID y te manda al túnel)
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);
  if (!match) return new Response("Uso: /pluto/{id}.m3u8", { status: 400 });

  const channelId = match[1];

  // Token de respaldo (Samsung TV Plus)
  const token = "eyJhbGciOiJIUzI1NiIsImtpZCI6IjI4NWVkZDI0LWUzZGMtNGMxNi04YjUwLTE5ZGI0ODY3M2UwOSIsInR5cCI6IkpXVCJ9.eyJwYXJ0bmVyIjoic2Ftc3VuZ3R2cGx1cyIsImZlYXR1cmVzIjp7Im11bHRpUG9kQWRzIjp7ImNvaG9ydCI6IiIsImVuYWJsZWQiOnRydWV9LCJzdGl0Y2hlckhsc05nIjp7ImRlbXV4ZWRBdWRpbyI6ImppdCJ9LCJzdGl0Y2hlckhsc05nIjp7ImRlbXV4ZWRBdWRpbyI6ImppdCJ9LCJzdGl0Y2hlclBhcnRuZXJTaG93U2xhdGUiOnsiZW5hYmxlZCI6dHJ1ZX19LCJpc3MiOiJzZXJ2aWNlLXBhcnRuZXItYXV0aC5wbHV0by50diIsInN1YiI6InByaTp2MTpwbHV0bzpkZXZpY2VzOmMyRnRjM1Z1WjNSMmNHeDFjdz09IiwiYXVkIjoiKi5wbHV0by50diIsImV4cCI6MTc3NDgwNTI0OSwiaWF0IjoxNzc0NzE4ODQ5LCJqdGkiOiIyZTk0NjYyNC04Njk4LTQwN2MtOWJiMy04MjQxMjA0ZWM2OWEifQ.V8xpvN0npjRuBa85tq4SKXS23taLGoG6zq80P0mpL-Q";

  const plutoUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=${token}`;

  // Redirigimos al Túnel (Ruta 1)
  return Response.redirect(`${url.origin}/proxy?url=${encodeURIComponent(plutoUrl)}`, 302);
});

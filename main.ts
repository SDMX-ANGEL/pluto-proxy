Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith('/proxy')) {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) return new Response("Falta url", { status: 400 });

      try {
          const res = await fetch(targetUrl, {
              headers: {
                  "User-Agent": "Mozilla/5.0",
                  "Referer": "https://pluto.tv/"
              }
          });

          const contentType = res.headers.get("content-type") || "";
          
          if (contentType.includes("mpegurl") || targetUrl.includes(".m3u8") || targetUrl.includes(".m3u")) {
              const text = await res.text();
              const parsedTarget = new URL(targetUrl);

              const fixedText = text.split('\n').map(line => {
                  const trimmed = line.trim();
                  if (trimmed && !trimmed.startsWith('#')) {
                      const absoluteUrl = new URL(trimmed, parsedTarget.href);
                      // Mantenemos los tokens de seguridad de Pluto TV
                      parsedTarget.searchParams.forEach((value, key) => {
                          if (!absoluteUrl.searchParams.has(key)) {
                              absoluteUrl.searchParams.set(key, value);
                          }
                      });
                      return `${url.origin}/proxy?url=${encodeURIComponent(absoluteUrl.href)}`;
                  }
                  return trimmed;
              }).join('\n');

              return new Response(fixedText, {
                  status: 200,
                  headers: {
                      "Content-Type": "application/vnd.apple.mpegurl",
                      "Access-Control-Allow-Origin": "*"
                  }
              });
          }

          return new Response(res.body, {
              status: res.status,
              headers: {
                  "Content-Type": contentType || "video/MP2T",
                  "Access-Control-Allow-Origin": "*"
              }
          });
      } catch (e) {
          return new Response("Error proxy", { status: 500 });
      }
  }

  const match = url.pathname.match(/^\/pluto\/([a-f0-9]+)$/i);
  if (!match) {
    return new Response("Uso: /pluto/{channelId}", { status: 400 });
  }

  const channelId = match[1];

  try {
    const now = new Date().toISOString();
    let apiUrl = `https://api.pluto.tv/v2/channels?channelIds=${channelId}&deviceType=web&deviceMake=web&deviceModel=web&appName=web&appVersion=9.20.0&clientID=abc123&deviceId=abc123&lang=es&serverNow=${encodeURIComponent(now)}`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Origin": "https://pluto.tv",
        "Referer": "https://pluto.tv/"
      },
    });

    if (!res.ok) {
        return new Response(`Error: ${await res.text()}`, { status: res.status });
    }

    const data = await res.json();
    const channel = Array.isArray(data) ? data[0] : null;
    let streamUrl = channel?.stitched?.urls?.[0]?.url;

    if (!streamUrl) {
      return new Response("Canal no encontrado", { status: 404 });
    }

    if (!streamUrl.includes("deviceModel=")) {
      streamUrl += "&deviceMake=web&deviceModel=web";
    }

    const m3u8Res = await fetch(streamUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://pluto.tv/"
        }
    });

    const m3u8Text = await m3u8Res.text();
    const parsedStreamUrl = new URL(streamUrl);

    // Reescribimos la lista maestra para pasar por nuestro proxy
    const fixedM3u8 = m3u8Text.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const variantUrl = new URL(trimmed, parsedStreamUrl.href);
            parsedStreamUrl.searchParams.forEach((value, key) => {
                if (!variantUrl.searchParams.has(key)) {
                    variantUrl.searchParams.set(key, value);
                }
            });
            return `${url.origin}/proxy?url=${encodeURIComponent(variantUrl.href)}`;
        }
        return trimmed;
    }).join('\n');

    return new Response(fixedM3u8, {
        status: 200,
        headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*"
        }
    });

  } catch (e) {
    return new Response("Error: " + (e as Error).message, { status: 500 });
  }
});

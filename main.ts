Deno.serve((req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];

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
    `&masterJWTPassthrough=1`;

  return Response.redirect(plutoUrl, 302);
});

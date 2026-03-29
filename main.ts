Deno.serve((req) => {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/pluto\/([a-z0-9]+)(?:\.m3u8)?$/i);

  if (!match) {
    return new Response("Uso: /pluto/{channelId}.m3u8", { status: 400 });
  }

  const channelId = match[1];
  const plutoSamsungUrl = `https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/${channelId}/master.m3u8?deviceType=samsung-tvplus&deviceMake=samsung&deviceModel=samsung&deviceVersion=unknown&appVersion=unknown&deviceLat=0&deviceLon=0&deviceDNT=%7BTARGETOPT%7D&deviceId=%7BPSID%7D&advertisingId=%7BPSID%7D&us_privacy=1YNY&samsung_app_domain=%7BAPP_DOMAIN%7D&samsung_app_name=%7BAPP_NAME%7D&profileLimit=&profileFloor=&embedPartner=samsung-tvplus&masterJWTPassthrough=1&authToken=eyJhbGciOiJIUzI1NiIsImtpZCI6IjI4NWVkZDI0LWUzZGMtNGMxNi04YjUwLTE5ZGI0ODY3M2UwOSIsInR5cCI6IkpXVCJ9.eyJwYXJ0bmVyIjoic2Ftc3VuZ3R2cGx1cyIsImZlYXR1cmVzIjp7Im11bHRpUG9kQWRzIjp7ImNvaG9ydCI6IiIsImVuYWJsZWQiOnRydWV9LCJzdGl0Y2hlckhsc05nIjp7ImRlbXV4ZWRBdWRpbyI6ImppdCJ9LCJzdGl0Y2hlclBhcnRuZXJTaG93U2xhdGUiOnsiZW5hYmxlZCI6dHJ1ZX19LCJpc3MiOiJzZXJ2aWNlLXBhcnRuZXItYXV0aC5wbHV0by50diIsInN1YiI6InByaTp2MTpwbHV0bzpkZXZpY2VzOmMyRnRjM1Z1WjNSMmNHeDFjdz09IiwiYXVkIjoiKi5wbHV0by50diIsImV4cCI6MTc3NDgwNTI0OSwiaWF0IjoxNzc0NzE4ODQ5LCJqdGkiOiIyZTk0NjYyNC04Njk4LTQwN2MtOWJiMy04MjQxMjA0ZWM2OWEifQ.V8xpvN0npjRuBa85tq4SKXS23taLGoG6zq80P0mpL-Q`;

  return Response.redirect(plutoSamsungUrl, 302);
});

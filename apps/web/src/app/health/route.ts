export function GET() {
  return Response.json(
    {
      service: "web",
      status: "ok",
      version: process.env.APP_VERSION ?? "development",
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}

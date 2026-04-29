export async function GET(req: Request) {
  // Back-compat alias: old endpoint moved to /api/inspo
  const url = new URL(req.url);
  url.pathname = "/api/inspo";
  return Response.redirect(url.toString(), 307);
}

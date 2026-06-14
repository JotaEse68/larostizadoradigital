export async function GET() {
  const verb = 'GET';
  return Response.json({ ok: true, verb });
}

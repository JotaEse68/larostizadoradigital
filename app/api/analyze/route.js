export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ ok: true, message: 'analyze route ready' });
}

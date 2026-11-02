import type { APIRoute } from 'astro';
import process from 'node:process';
import { createAdminSessionCookie, verifyAdminPassword } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return Response.json({ error: 'ADMIN_PASSWORD dan ADMIN_SESSION_SECRET belum dikonfigurasi.' }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Permintaan login tidak valid.' }, { status: 400 });
  }

  if (!verifyAdminPassword(String(body.password || ''))) {
    return Response.json({ error: 'Password salah.' }, { status: 401 });
  }

  const cookie = createAdminSessionCookie();
  if (!cookie) return Response.json({ error: 'ADMIN_SESSION_SECRET belum tersedia.' }, { status: 503 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': cookie,
    },
  });
};

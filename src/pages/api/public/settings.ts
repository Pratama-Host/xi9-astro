import type { APIRoute } from 'astro';
import { getSettings } from '../../../lib/data';

export const prerender = false;

export const GET: APIRoute = async () => {
  const settings = await getSettings();
  return Response.json({ media: settings.media || {} }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  });
};

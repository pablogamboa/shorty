import { Router } from 'itty-router';
import { customAlphabet } from 'nanoid';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import validator from 'validator';

const DEFAULT_SLUG_LENGTH = 7;
const MIN_SLUG_LENGTH = 1;
const MAX_SLUG_LENGTH = 32;
const router = Router();
const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  DEFAULT_SLUG_LENGTH,
);

/**
 * Handler for getLink. Receives a slug, it returns a redirect or a 404.
 */
router.get('/:slug', async request => {
  const link = await SHORTY.get(request.params.slug, { type: "json" });
  if (!link) {
    return new Response('Not found.', {
      status: 404,
    });
  }

  return Response.redirect(link.url, link.status);
});

/**
 * Handler for createLink. Receives a URL and optionally a status and/or a slug.
 */
router.post('/links', async request => {
  let { url, status, slug } = await request.json();

  if (!validator.isURL(url)) {
    return new Response("Invalid URL.", { status: 400 });
  }

  if (!status) {
    status = 302;
  } else if (status !== 301 && status !== 302) {
    return new Response("Invalid status.", { status: 400 });
  }

  if (!slug) {
    slug = nanoid();
  } else if (typeof slug !== 'string' || slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return new Response("Invalid slug.", { status: 400 });
  } else {
    const obj = await SHORTY.get(slug);
    if (obj) {
      return new Response("Invalid slug.", { status: 409 });
    }
  }

  const body = JSON.stringify({ url, status, slug });
  await SHORTY.put(slug, body, { expirationTtl: 86400 });

  const responseBody = {
    slug,
    shortened: `${new URL(request.url).origin}/${slug}`,
  };
  return new Response(JSON.stringify(responseBody), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
});

/**
 * Handles a Cloudflare event. It either returns a JSON response or an asset from KV.
 * @param {Event} Cloudflare event
 * @returns {Response} Cloudflare Response
 */
async function handleEvent(event) {
  let requestUrl = new URL(event.request.url);
  if (requestUrl.pathname === '/' || requestUrl.pathname.includes('static')) {
    return await getAssetFromKV(event);
  } else {
    return await router.handle(event.request);
  }
}

/**
 * Cloudflare entry point
 */
addEventListener('fetch', event => {
  event.respondWith(handleEvent(event));
});

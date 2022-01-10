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
 * Normalizes a URL
 * @param {String} url
 * @returns normalized URL
 */
function normalizeUrl(url) {
  // if the URL starts with uppercase then lowercase it as the user
  // probably is entering the data from a phone keyboard
  if (url.charAt(0) === url.charAt(0).toUpperCase()) {
    url = url.charAt(0).toLowerCase() + url.slice(1);
  }

  // if the user forgot to add a protocol, let's asume it's https://
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  return url;
}

/**
 * Creates a JSON response
 * @param {Object} body
 * @param {*} statusCode
 * @returns
 */
function createResponse(body, statusCode) {
  statusCode = statusCode || 200;
  return new Response(
    JSON.stringify(body, {
      headers: { 'content-type': 'application/json' },
      status: statusCode,
    }),
  );
}

/**
 * Creates a JSON error
 * @param {String} message
 * @param {Number} statusCode
 */
function createError(message, statusCode) {
  statusCode = statusCode || 400;
  return createResponse({ error: true, message }, statusCode);
}

/**
 * Handler for getLink. Receives a slug, it returns a redirect or a 404.
 */
router.get('/:slug', async request => {
  const link = await SHORTY.get(request.params.slug, { type: 'json' });
  if (!link) {
    // return a plain 404 HTTP error, no need for JSON errors here
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

  // process URL and make sure it's valid
  if (!url) {
    console.debug("User didn't pass a URL");
    return createError('Invalid URL.', 400);
  }
  url = normalizeUrl(url);
  if (!validator.isURL(url)) {
    console.warn('User passed an invalid URL', url);
    return createError('Invalid URL.', 400);
  }

  // status must be a number and either 301 or 302
  if (!status) {
    status = 302;
  }
  if (typeof status !== 'number' || (status !== 301 && status !== 302)) {
    console.warn('User passed an invalid status', status);
    return createError('Invalid status.', 400);
  }

  // process slug and make sure it's valid
  if (slug) {
    if (
      typeof slug !== 'string' ||
      slug.length < MIN_SLUG_LENGTH ||
      slug.length > MAX_SLUG_LENGTH
    ) {
      console.warn('User passed an invalid slug', slug);
      return createError('Invalid slug.', 400);
    }

    // if the user passed a slug, make sure it doesn't exist already!
    const obj = await SHORTY.get(slug);
    if (obj) {
      console.warn("User passed a slug and it's taken already!", slug);
      return createError('Invalid slug.', 409);
    }
  } else {
    slug = nanoid();
  }

  // now store the link, good for one day
  const body = JSON.stringify({ url, status, slug });
  await SHORTY.put(slug, body, { expirationTtl: 86400 });

  // finally send response back to caller.
  const shortened = `${new URL(request.url).origin}/${slug}`;
  console.info('Shortened', url, 'to', shortened);

  return createResponse({ slug, shortened }, 200);
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

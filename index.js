/**
 * Host half of the API Credits plugin.
 *
 * Two loopback routes, both guarded by a per-process token that the same Host
 * injects into the page it serves; without that token a request gets 403.
 *
 * - `/api-credits/balance` — the account wallet readout. A dynamic Client plugin
 *   cannot always reach the account Remote namespace, so the Host serves it.
 * - `/api-credits/spend` — subagent-aware spend for one Session tree. The Client
 *   already sees its own `tokenUsage` projection, but a subagent is a separate
 *   Session with its own log, so the whole-tree total can only be assembled
 *   where the projection services live. See `./spend.js`.
 *
 * Exchange rates stay in the browser: they are public data and six providers
 * already send CORS headers.
 */
import { randomUUID } from 'node:crypto';
import { createSpendReader, isSessionId } from './spend.js';

const ROUTE = '/api-credits/balance';
const SPEND_ROUTE = '/api-credits/spend';
const CACHE_MS = 30_000;
const TOKEN_GLOBAL = '__DSH_API_CREDITS_TOKEN__';

export const inject = ['webServer'];

export function apply(ctx) {
  const token = randomUUID();
  let cache;

  const clientOf = (url) => ({
    version: '1.1.0',
    locale: url.searchParams.get('lang') || 'en',
    timezoneOffsetSeconds: Number(url.searchParams.get('tz')) || 0,
  });

  const readBalance = async (client) => {
    if (cache !== undefined && Date.now() - cache.at < CACHE_MS) return cache.payload;
    const account = ctx.get('deepseekAccount');
    if (account === undefined) {
      return { ok: false, reason: 'no-account-service' };
    }
    try {
      const state = await account.getState();
      const signedIn = state?.status === 'credential-stored';
      const balance = signedIn ? await account.getBalance(client) : null;
      const payload = { ok: true, signedIn, balance, at: Date.now() };
      cache = { at: Date.now(), payload };
      return payload;
    } catch (error) {
      return { ok: false, reason: 'read-failed', message: String(error?.message ?? error) };
    }
  };

  const spend = createSpendReader({
    getService: (name) => ctx.get(name),
    warn: (message) => {
      try {
        ctx.logger?.warn?.(message);
      } catch {
        /* logging must never fail the readout */
      }
    },
  });

  /** Shared request plumbing: method check, token check, and JSON framing. */
  const serveJson = async (request, response, produce) => {
    response.setHeader('cache-control', 'no-store');
    if (request.method !== 'GET') {
      response.statusCode = 405;
      response.end();
      return;
    }
    let url;
    try {
      url = new URL(request.url ?? '/', 'http://127.0.0.1');
    } catch {
      response.statusCode = 400;
      response.end();
      return;
    }
    if (url.searchParams.get('t') !== token) {
      response.statusCode = 403;
      response.end('forbidden');
      return;
    }
    try {
      const payload = await produce(url);
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.statusCode = 200;
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.statusCode = 500;
      response.end(JSON.stringify({ ok: false, reason: 'handler-failed', message: String(error?.message ?? error) }));
    }
  };

  ctx.effect(() =>
    ctx.webServer.tapIndex((html) => {
      const script = `<script>window.${TOKEN_GLOBAL}=${JSON.stringify(token)}</script>`;
      return html.includes('</head>') ? html.replace('</head>', script + '</head>') : script + html;
    }),
  );

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: ROUTE,
      handler: (request, response) =>
        serveJson(request, response, async (url) => readBalance(clientOf(url))),
    }),
  );

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: SPEND_ROUTE,
      handler: (request, response) =>
        serveJson(request, response, async (url) => {
          const sessionId = url.searchParams.get('session');
          if (!isSessionId(sessionId)) return { ok: false, reason: 'bad-session' };
          return spend.read(sessionId);
        }),
    }),
  );

  return () => {
    spend.clear();
  };
}

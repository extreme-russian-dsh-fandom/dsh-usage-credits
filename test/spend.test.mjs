import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_DEPTH,
  addBuckets,
  createSpendReader,
  foldUsage,
  isSessionId,
  normalizeBuckets,
  zeroBuckets,
} from '../spend.js';

/** One provider usage sample in the shape `dsh-llm` reports. */
const sample = (inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) => ({
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheWriteTokens,
});

let seq = 0;
const assistant = (turn, step, usage, stream) => ({
  type: 'assistant/message',
  seq: (seq += 1),
  data: { turn, step, usage, ...(stream === undefined ? {} : { stream }) },
});
const usageChunk = (usage) => [{ type: 'chunk', time: 0, chunk: { type: 'usage', usage } }];

const buckets = (uncachedInputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) => ({
  uncachedInputTokens,
  outputTokens,
  cacheReadTokens,
  cacheWriteTokens,
});

/** A fake Session: only the members `spend.js` reads. */
function fakeSession({ id, inheritedEventCount = 0, events = [], projections = {} }) {
  return {
    id,
    inheritedEventCount,
    events,
    ownEvents: () => events.filter((event) => event.seq >= inheritedEventCount),
    projections,
  };
}

const USAGE_KEYS = ['tokenUsage', 'subagentCatalog'];

/** The projection snapshot a fake Host folds for one Session. */
function fakeSnapshot(session) {
  const values = {};
  for (const key of USAGE_KEYS) {
    if (session.projections[key] !== undefined) values[key] = session.projections[key];
  }
  return { asOfSeq: 1, values };
}

/**
 * Build a fake Host service table.
 * @param sessions - session id → { session, running }.
 * @param options.live - ids reported as live.
 * @param options.api - the read face the Host advertises: `observe` (this
 *   Harness), `inspect` (an older callback read), or `replay` (`readSession`).
 * @param options.disposed - collects the ids whose observation lease was released.
 */
function fakeServices(sessions, { live = [], api = 'observe', disposed = [] } = {}) {
  const reads = [];
  const find = (sessionId) => {
    const entry = sessions[sessionId];
    if (entry === undefined) {
      const error = new Error(`session "${sessionId}" not found`);
      error.code = 'SESSION_QUERY_SESSION_NOT_FOUND';
      throw error;
    }
    return entry.session;
  };
  const faces = {
    async observeSession(sessionId, options) {
      reads.push(sessionId);
      const session = find(sessionId);
      return {
        inheritedEventCount: session.inheritedEventCount,
        events: session.events,
        projections: options && options.projectionMode === 'all' ? fakeSnapshot(session) : undefined,
        [Symbol.dispose]() {
          disposed.push(sessionId);
        },
      };
    },
    async inspectSession(sessionId, read) {
      reads.push(sessionId);
      return read(find(sessionId));
    },
    async readSession(sessionId) {
      reads.push(sessionId);
      const session = find(sessionId);
      return { session: { id: session.id }, inheritedEventCount: session.inheritedEventCount, events: session.events };
    },
  };
  const services = {
    sessionQuery:
      api === 'observe'
        ? { observeSession: faces.observeSession }
        : api === 'inspect'
          ? { inspectSession: faces.inspectSession }
          : { readSession: faces.readSession },
    sessionProjections: { snapshot: (session) => fakeSnapshot(session) },
    sessions: { list: () => live.map((id) => ({ id })) },
  };
  return { getService: (name) => services[name], reads };
}

test('foldUsage prices a repeated attempt once and a retried attempt twice', () => {
  seq = 0;
  const events = [
    assistant(1, 1, sample(100, 10)),
    assistant(1, 1, sample(120, 12)), // same attempt: replaces
    { type: 'llm/retry-started', seq: (seq += 1), data: { turn: 1, step: 1 } },
    assistant(1, 1, sample(200, 20)), // retried attempt: adds
  ];
  assert.deepEqual(foldUsage(events), {
    uncachedInputTokens: 320,
    outputTokens: 32,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
});

test('foldUsage reads the usage chunk when the settlement carries none', () => {
  seq = 0;
  const events = [assistant(2, 1, undefined, usageChunk(sample(7, 3, 4, 5)))];
  assert.deepEqual(foldUsage(events), {
    uncachedInputTokens: 7,
    outputTokens: 3,
    cacheReadTokens: 4,
    cacheWriteTokens: 5,
  });
});

test('foldUsage ignores events below fromSeq', () => {
  seq = 0;
  const events = [assistant(1, 1, sample(100, 10)), assistant(1, 2, sample(50, 5))];
  assert.deepEqual(foldUsage(events, 2), {
    uncachedInputTokens: 50,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
});

test('normalizeBuckets rejects absent values and coerces junk', () => {
  assert.equal(normalizeBuckets(undefined), null);
  assert.equal(normalizeBuckets(null), null);
  assert.deepEqual(normalizeBuckets({ uncachedInputTokens: '4', outputTokens: -9 }), {
    uncachedInputTokens: 4,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
});

test('isSessionId accepts Harness ids and rejects everything else', () => {
  assert.equal(isSessionId('session-39e20eb6-9f53-4736-98e1-5ee6e1bc7700'), true);
  assert.equal(isSessionId('session-2f82e7bc-f9a1-421c-a39a-38b1fa44984c'), true);
  assert.equal(isSessionId('session-'), false);
  assert.equal(isSessionId('39e20eb6'), false);
  assert.equal(isSessionId('../etc/passwd'), false);
  assert.equal(isSessionId(''), false);
  assert.equal(isSessionId(undefined), false);
});

test('a seeded session is priced from its own events, not the inherited prefix', () => {
  // A seeded log carries the parent's prefix at the low seqs: `inheritedEventCount`
  // is the count of those, so only events at or past it belong to this child.
  const prefix = [{ type: 'assistant/message', seq: 0, data: { turn: 1, step: 1, usage: sample(1000, 100) } }];
  const own = [{ type: 'assistant/message', seq: 1, data: { turn: 2, step: 1, usage: sample(20, 2) } }];
  const session = fakeSession({
    id: 'session-child',
    inheritedEventCount: 1,
    events: [...prefix, ...own],
    // The projection folds the inherited prefix as well: 1000 input, not 20.
    projections: { tokenUsage: buckets(1020, 102), subagentCatalog: [] },
  });
  const { getService } = fakeServices({ 'session-child': { session } });
  const reader = createSpendReader({ getService });
  return reader.read('session-child').then((payload) => {
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.own, buckets(20, 2));
  });
});

test('walks the catalog tree, totals every agent, and reports externals and gaps', async () => {
  const root = fakeSession({
    id: 'session-root',
    projections: {
      tokenUsage: buckets(10, 1),
      subagentCatalog: [
        { id: 'session-a', mode: 'continuable', name: 'a', label: 'first' },
        { id: 'session-b', mode: 'one-shot', label: 'second' },
        { id: 'session-ext', mode: 'external', name: 'codex' },
        { id: 'session-gone', mode: 'continuable', label: 'lost' },
      ],
    },
  });
  const a = fakeSession({
    id: 'session-a',
    projections: {
      tokenUsage: buckets(100, 10),
      subagentCatalog: [{ id: 'session-a1', mode: 'continuable', name: 'a1', label: 'nested' }],
    },
  });
  const a1 = fakeSession({ id: 'session-a1', projections: { tokenUsage: buckets(1000, 100), subagentCatalog: [] } });
  const b = fakeSession({ id: 'session-b', projections: { tokenUsage: buckets(50, 5), subagentCatalog: [] } });
  const { getService } = fakeServices({
    'session-root': { session: root },
    'session-a': { session: a },
    'session-a1': { session: a1 },
    'session-b': { session: b },
  });
  const reader = createSpendReader({ getService });

  const payload = await reader.read('session-root');
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.own, buckets(10, 1));
  assert.deepEqual(payload.agents.map((agent) => agent.id), ['session-a', 'session-a1', 'session-b']);
  assert.deepEqual(payload.agents.map((agent) => agent.depth), [1, 2, 1]);
  assert.deepEqual(payload.agents[1].parentId, 'session-a');
  assert.deepEqual(payload.totals, buckets(1160, 116));
  assert.deepEqual(payload.externals.map((external) => external.id), ['session-ext']);
  assert.deepEqual(payload.missing, [{ id: 'session-gone', reason: 'unreadable' }]);
  assert.equal(payload.truncated, false);
});

test('a chain deeper than MAX_DEPTH is truncated instead of walked forever', async () => {
  const sessions = {};
  const ids = Array.from({ length: MAX_DEPTH + 3 }, (_, index) => `session-d${index}`);
  ids.forEach((id, index) => {
    sessions[id] = {
      session: fakeSession({
        id,
        projections: {
          tokenUsage: buckets(1, 1),
          subagentCatalog: ids[index + 1] === undefined ? [] : [{ id: ids[index + 1], mode: 'one-shot' }],
        },
      }),
    };
  });
  const { getService } = fakeServices(sessions);
  const reader = createSpendReader({ getService });
  const payload = await reader.read(ids[0]);
  assert.equal(payload.truncated, true);
  assert.equal(payload.agents.length, MAX_DEPTH);
});

test('the tree reply is cached inside TREE_TTL_MS and a cold node inside NODE_TTL_MS', async () => {
  const calls = [];
  const sessions = {
    'session-root': {
      session: fakeSession({
        id: 'session-root',
        projections: {
          tokenUsage: buckets(1, 1),
          subagentCatalog: [{ id: 'session-kid', mode: 'one-shot' }],
        },
      }),
    },
    'session-kid': { session: fakeSession({ id: 'session-kid', projections: { tokenUsage: buckets(2, 2), subagentCatalog: [] } }) },
  };
  let clock = 1_000;
  const { getService } = fakeServices(sessions, { live: ['session-root'] });
  const wrapped = (name) => {
    if (name !== 'sessionQuery') return getService(name);
    return {
      observeSession: (sessionId, options) => {
        calls.push(sessionId);
        return getService(name).observeSession(sessionId, options);
      },
    };
  };
  const reader = createSpendReader({ getService: wrapped, now: () => clock });

  await reader.read('session-root');
  assert.deepEqual(calls, ['session-root', 'session-kid']);

  clock += 1_000; // inside the tree TTL: no reads at all
  await reader.read('session-root');
  assert.deepEqual(calls, ['session-root', 'session-kid']);

  clock += 10_000; // past the tree TTL, inside the cold-node TTL: root only
  await reader.read('session-root');
  assert.deepEqual(calls, ['session-root', 'session-kid', 'session-root']);
});

test('an unreadable root reports failure so the Client can fall back', async () => {
  const { getService } = fakeServices({});
  const reader = createSpendReader({ getService });
  const payload = await reader.read('session-missing');
  assert.deepEqual(payload, { ok: false, reason: 'read-failed' });
});

test('a root without the usage projection reports no-usage', async () => {
  const { getService } = fakeServices({
    'session-empty': { session: fakeSession({ id: 'session-empty', projections: {} }) },
  });
  const reader = createSpendReader({ getService });
  const payload = await reader.read('session-empty');
  assert.deepEqual(payload, { ok: false, reason: 'no-usage' });
});

test('every observed node releases its observation lease', async () => {
  const disposed = [];
  const sessions = {
    'session-root': {
      session: fakeSession({
        id: 'session-root',
        projections: { tokenUsage: buckets(1, 1), subagentCatalog: [{ id: 'session-kid', mode: 'one-shot' }] },
      }),
    },
    'session-kid': { session: fakeSession({ id: 'session-kid', projections: { tokenUsage: buckets(2, 2), subagentCatalog: [] } }) },
  };
  const { getService } = fakeServices(sessions, { disposed });
  const reader = createSpendReader({ getService });
  await reader.read('session-root');
  assert.deepEqual(disposed, ['session-root', 'session-kid']);
});

test('a Host with only the callback read still walks the tree', async () => {
  const sessions = {
    'session-root': {
      session: fakeSession({
        id: 'session-root',
        projections: { tokenUsage: buckets(1, 1), subagentCatalog: [{ id: 'session-kid', mode: 'one-shot' }] },
      }),
    },
    'session-kid': { session: fakeSession({ id: 'session-kid', projections: { tokenUsage: buckets(2, 2), subagentCatalog: [] } }) },
  };
  const { getService } = fakeServices(sessions, { api: 'inspect' });
  const reader = createSpendReader({ getService });
  const payload = await reader.read('session-root');
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.totals, buckets(3, 3));
});

test('a Host with only readSession folds the usage out of the log', async () => {
  seq = 0;
  const sessions = {
    'session-root': {
      session: fakeSession({
        id: 'session-root',
        events: [assistant(1, 1, sample(10, 1)), assistant(1, 2, sample(20, 2))],
        projections: {},
      }),
    },
  };
  const { getService } = fakeServices(sessions, { api: 'replay' });
  const reader = createSpendReader({ getService });
  const payload = await reader.read('session-root');
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.own, buckets(30, 3));
});

test('the child list comes from the service when no projection carries it', async () => {
  const sessions = {
    'session-root': { session: fakeSession({ id: 'session-root', projections: { tokenUsage: buckets(1, 1) } }) },
    'session-kid': { session: fakeSession({ id: 'session-kid', projections: { tokenUsage: buckets(4, 2) } }) },
  };
  const { getService } = fakeServices(sessions);
  const subagents = {
    listChildren: async (sessionId) =>
      sessionId === 'session-root' ? [{ id: 'session-kid', mode: 'one-shot', label: 'kid' }] : [],
  };
  const reader = createSpendReader({ getService: (name) => (name === 'subagents' ? subagents : getService(name)) });
  const payload = await reader.read('session-root');
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.agents.map((agent) => agent.id), ['session-kid']);
  assert.deepEqual(payload.totals, buckets(5, 3));
});

test('addBuckets is elementwise', () => {
  assert.deepEqual(addBuckets(zeroBuckets(), buckets(1, 2, 3, 4)), buckets(1, 2, 3, 4));
});

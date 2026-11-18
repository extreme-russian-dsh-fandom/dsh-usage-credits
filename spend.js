/**
 * Subagent-aware spend aggregation for the API Credits Host half.
 *
 * A subagent in DSH is a separate Session with its own log: the parent records
 * only `subagent/catalog` membership, never the child's tokens. So the session's
 * official `tokenUsage` projection describes the orchestrator alone, and the
 * spend readout has to walk the catalog tree, read every child's projection, and
 * add the buckets up.
 *
 * Two invariants shape the code:
 *
 * 1. Reading is observation only. `ctx.sessionQuery.inspectSession` restores a
 *    cold Session without activating an Agent and without a model call, and
 *    `ctx.sessionProjections.snapshot` folds the requested units at that cut.
 * 2. A fork child (`subagent_fork`) is seeded with a prefix of its parent's log,
 *    and the projection folds that inherited prefix too. Summing the child's
 *    `tokenUsage` as-is would count the parent's history twice, so a seeded node
 *    is priced from its own events only (`Session.ownEvents`).
 *
 * The module is dependency-free so it can be unit-tested without a Harness.
 */

/** Hard cap on counted descendants; past it the reply is `truncated`. */
export const MAX_NODES = 300;
/** Hard cap on catalog depth; deeper trees are not walked. */
export const MAX_DEPTH = 6;
/** Cache lifetime of one finished tree reply. */
export const TREE_TTL_MS = 4_000;
/** Cache lifetime of one cold (not live) node read. */
export const NODE_TTL_MS = 5 * 60_000;
/** Wall-clock budget for one tree walk; the caller answers with what it has. */
export const TREE_DEADLINE_MS = 4_000;
/** Bound on the cold-node cache so long-lived Hosts cannot grow without limit. */
const NODE_CACHE_LIMIT = 512;

const USAGE_KEYS = new Set(['tokenUsage', 'subagentCatalog']);
const SESSION_ID = /^session-[A-Za-z0-9-]{8,64}$/;

/**
 * Whether a value is a plausible Session id for the spend route.
 * @param value - untrusted query parameter.
 * @returns true when it may be handed to the projection services.
 */
export function isSessionId(value) {
  return typeof value === 'string' && SESSION_ID.test(value);
}

/** One disjoint billing bucket set, all zero. */
export function zeroBuckets() {
  return { uncachedInputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
}

/**
 * Sum two bucket sets.
 * @param left - first set.
 * @param right - second set.
 * @returns a new set with each bucket summed.
 */
export function addBuckets(left, right) {
  return {
    uncachedInputTokens: left.uncachedInputTokens + right.uncachedInputTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  };
}

const count = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);

/**
 * Coerce one projection value into the bucket shape, or null when absent.
 * @param raw - `tokenUsage` projection value.
 * @returns normalized buckets, or null.
 */
export function normalizeBuckets(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    uncachedInputTokens: count(raw.uncachedInputTokens),
    cacheWriteTokens: count(raw.cacheWriteTokens),
    cacheReadTokens: count(raw.cacheReadTokens),
    outputTokens: count(raw.outputTokens),
  };
}

/** The last provider usage sample of one compact assistant stream, if any. */
function lastStreamUsage(stream) {
  if (!Array.isArray(stream)) return undefined;
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index];
    if (record && record.type === 'chunk' && record.chunk && record.chunk.type === 'usage' && record.chunk.usage) {
      return record.chunk.usage;
    }
  }
  return undefined;
}

/** The usage one durable settlement reports for its attempt, if any. */
function usageOf(event) {
  if (event.type === 'assistant/message' && event.data && event.data.usage !== undefined) return event.data.usage;
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return undefined;
  return lastStreamUsage(event.data && event.data.stream);
}

/**
 * Fold provider usage over events, mirroring the `token-meter` rules:
 * an attempt's later sample replaces its earlier one, and `llm/retry-started`
 * closes that replacement scope so a retried attempt counts again.
 *
 * This duplicates ~15 lines of `@deepseek-ai/dsh-token-meter` on purpose: it is
 * the only way to price the own suffix of a fork-seeded Session, whose official
 * `tokenUsage` covers the inherited prefix as well.
 * @param events - session events in log order.
 * @param fromSeq - first seq to fold; earlier events are ignored.
 * @returns the folded buckets.
 */
export function foldUsage(events, fromSeq = 0) {
  let totals = zeroBuckets();
  let last = null;
  for (const event of events) {
    if (typeof event.seq === 'number' && event.seq < fromSeq) continue;
    if (event.type === 'llm/retry-started') {
      if (last && last.turn === event.data.turn && last.step === event.data.step) last = null;
      continue;
    }
    const usage = usageOf(event);
    if (usage === undefined) continue;
    const buckets = {
      uncachedInputTokens: count(usage.inputTokens),
      cacheWriteTokens: count(usage.cacheWriteTokens),
      cacheReadTokens: count(usage.cacheReadTokens),
      outputTokens: count(usage.outputTokens),
    };
    const turn = event.data.turn;
    const step = event.data.step;
    if (last && last.turn === turn && last.step === step) {
      totals = {
        uncachedInputTokens: totals.uncachedInputTokens - last.buckets.uncachedInputTokens,
        cacheWriteTokens: totals.cacheWriteTokens - last.buckets.cacheWriteTokens,
        cacheReadTokens: totals.cacheReadTokens - last.buckets.cacheReadTokens,
        outputTokens: totals.outputTokens - last.buckets.outputTokens,
      };
    }
    totals = addBuckets(totals, buckets);
    last = { turn, step, buckets };
  }
  return totals;
}

/** Keep only the catalog fields the reply exposes. */
function normalizeCatalog(value) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = typeof entry.id === 'string' ? entry.id : undefined;
    if (id === undefined) continue;
    rows.push({
      id,
      mode: typeof entry.mode === 'string' ? entry.mode : 'unknown',
      name: typeof entry.name === 'string' ? entry.name : undefined,
      label: typeof entry.label === 'string' ? entry.label : undefined,
    });
  }
  return rows;
}

/**
 * Build the spend reader over the Host's projection services.
 * @param options.getService - `ctx.get`, resolved lazily on every call.
 * @param options.now - clock override for tests.
 * @param options.warn - diagnostic sink for unexpected read failures.
 * @returns `{ read(sessionId, signal) }` producing one tree reply.
 */
export function createSpendReader({ getService, now = Date.now, warn = () => {} }) {
  /** @type {Map<string, { at: number, payload: unknown }>} */
  const trees = new Map();
  /** @type {Map<string, { at: number, node: unknown }>} */
  const nodes = new Map();

  const prune = (cache, limit) => {
    if (cache.size <= limit) return;
    const excess = cache.size - limit;
    let removed = 0;
    for (const key of cache.keys()) {
      cache.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  };

  const runningOf = (sessionId) => {
    const agents = getService('agents');
    if (!agents || typeof agents.get !== 'function') return false;
    const agent = agents.get(sessionId);
    return !!(agent && agent.status === 'running');
  };

  const readNode = async (sessionId, liveIds) => {
    const query = getService('sessionQuery');
    const projections = getService('sessionProjections');
    if (!query || !projections) return null;
    const live = liveIds.has(sessionId);
    if (!live) {
      const cached = nodes.get(sessionId);
      if (cached !== undefined && now() - cached.at < NODE_TTL_MS) return cached.node;
    }
    const node = await query.inspectSession(sessionId, (session) => {
      const snapshot = projections.snapshot(session, USAGE_KEYS);
      const inherited = Number(session.inheritedEventCount) || 0;
      const usage = inherited > 0
        ? foldUsage(session.ownEvents())
        : normalizeBuckets(snapshot.values.tokenUsage);
      return {
        id: sessionId,
        asOfSeq: snapshot.asOfSeq,
        inherited,
        usage,
        catalog: normalizeCatalog(snapshot.values.subagentCatalog),
        running: runningOf(sessionId),
      };
    });
    if (!live) {
      nodes.set(sessionId, { at: now(), node });
      prune(nodes, NODE_CACHE_LIMIT);
    }
    return node;
  };

  const liveIdsOf = () => {
    const sessions = getService('sessions');
    if (!sessions || typeof sessions.list !== 'function') return new Set();
    try {
      return new Set(sessions.list().map((session) => session.id));
    } catch (error) {
      warn(`spend: live session listing failed: ${String(error)}`);
      return new Set();
    }
  };

  /**
   * Aggregate one Session and every descendant visible through its catalog.
   * @param sessionId - root Session identity.
   * @param signal - optional cancellation for cold reads.
   * @returns the reply payload; `ok` is false when the root itself is unreadable.
   */
  const read = async (sessionId, signal) => {
    const cachedTree = trees.get(sessionId);
    if (cachedTree !== undefined && now() - cachedTree.at < TREE_TTL_MS) return cachedTree.payload;

    const liveIds = liveIdsOf();
    const deadline = now() + TREE_DEADLINE_MS;
    const agents = [];
    const externals = [];
    const missing = [];
    let truncated = false;
    let anyRunning = false;

    let root;
    try {
      root = await readNode(sessionId, liveIds);
    } catch (error) {
      warn(`spend: root read failed for ${sessionId}: ${String(error)}`);
      return { ok: false, reason: 'read-failed' };
    }
    if (root === null) return { ok: false, reason: 'no-projection-services' };
    // Without the root's own usage there is nothing to stand on: let the Client
    // keep its `tokenUsage` readout instead of painting a confident zero.
    if (root.usage === null) return { ok: false, reason: 'no-usage' };
    anyRunning ||= root.running === true;

    const seen = new Set([sessionId]);

    const visit = async (node, depth) => {
      for (const entry of node.catalog) {
        if (signal && signal.aborted) {
          truncated = true;
          return;
        }
        if (entry.mode === 'external') {
          externals.push({ id: entry.id, name: entry.name, label: entry.label });
          continue;
        }
        if (agents.length >= MAX_NODES || depth > MAX_DEPTH) {
          truncated = true;
          return;
        }
        if (now() > deadline) {
          truncated = true;
          return;
        }
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        let child;
        try {
          child = await readNode(entry.id, liveIds);
        } catch (error) {
          warn(`spend: child read failed for ${entry.id}: ${String(error)}`);
          missing.push({ id: entry.id, reason: 'unreadable' });
          continue;
        }
        if (child === null) {
          missing.push({ id: entry.id, reason: 'unreadable' });
          continue;
        }
        anyRunning ||= child.running === true;
        agents.push({
          id: entry.id,
          parentId: node.id,
          depth,
          name: entry.name,
          label: entry.label,
          mode: entry.mode,
          inherited: child.inherited,
          running: child.running === true,
          usage: child.usage === null ? zeroBuckets() : child.usage,
        });
        if (child.usage === null) missing.push({ id: entry.id, reason: 'no-usage' });
        await visit(child, depth + 1);
      }
    };

    await visit(root, 1);

    const own = root.usage;
    let totals = own;
    for (const agent of agents) totals = addBuckets(totals, agent.usage);

    const payload = {
      ok: true,
      sessionId,
      at: now(),
      asOfSeq: root.asOfSeq,
      own,
      agents,
      totals,
      externals,
      missing,
      truncated,
      anyRunning,
    };
    trees.set(sessionId, { at: payload.at, payload });
    prune(trees, NODE_CACHE_LIMIT);
    return payload;
  };

  /** Drop every cached tree and node; used by tests and by Host disposal. */
  const clear = () => {
    trees.clear();
    nodes.clear();
  };

  return { read, clear };
}

# DSH Usage & Credits

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that shows your **API credit balance** and the **credit spend of the current session — including every subagent it spawned** — right under the composer, in CNY, USD and your own local currency, at live exchange rates.

> The balance is what is left in your DeepSeek account. The spend is what this conversation has already consumed, priced by the actual billing buckets, including cache hits — and, unlike a bare session counter, it also counts the child agents that did the work.

## What you get

| Where | What |
|---|---|
| Composer dock | `¥12.34 ($1.85, 151 ₽)` — topped-up balance: yuan first, then dollars and your local currency |
| Composer dock | `−¥2.91 +18` — whole-tree spend with a receipt icon; `+18` marks the number of subagent sessions; hover for the full breakdown |
| Tooltip | Billing buckets, total, this session vs subagents, the five most expensive agents, external agents that cannot be measured, cache state |
| Settings → API Credits | Balance in its native wallets (`¥12.34 + $1.85`), the local-currency equivalent, local currency picker, spend-currency switch, subagent accounting switch, rate details, refresh button |

The balance pill follows the same visual language as DSH's own `N tok` pills: same row, same spacing, same typography, theme tokens only.

## Why the spend is not "tokens × price"

DeepSeek bills input in two very different buckets:

* **cache hit** — the prompt prefix was already cached, roughly **50× cheaper** than a miss;
* **cache miss** — fresh input, billed at the full input price.

A long agent session easily reaches tens of millions of prompt tokens because the whole context is resent every step. All of those tokens are counted by the UI, but most of them are cache hits. Multiplying the total by the miss price overstates the bill by tens of times.

The plugin prices each bucket separately, straight from the session's `tokenUsage` projection:

```
cost = (uncachedInput + cacheWrite) × miss
     + cacheRead                     × hit
     + output                        × output
     × (peak ? 2 : 1)
```

Real numbers from a 13.9M-token session with a 99% cache hit rate: **¥0.65**, while "everything at miss price" would claim ¥27.80 — a 42× overestimate.

## Subagents count too

A subagent is a separate DSH session with its own log, so this session's `tokenUsage` projection cannot see it. The pill therefore asks the Host for the whole tree:

* the Host walks the durable `subagentCatalog` of the session, reads each child's `tokenUsage` through `ctx.sessionQuery.inspectSession` (no Agent is activated and no model call is made), and adds the four billing buckets up;
* a cold child is read once and cached for 5 minutes; a finished tree reply is cached for 4 seconds;
* a `subagent_fork` child is seeded with a prefix of its parent's log, and its own `tokenUsage` already includes that prefix — such a node is priced from its own log suffix only, so the parent's history is never counted twice;
* external agents (ACP, Codex, Claude Code) have no local DSH log at all; the tooltip labels them as not measured instead of silently dropping them.

The tooltip splits the number into this session, all subagents, and the five most expensive agents. If the aggregate is unavailable — an older Host, a disabled route, a read failure — the pill keeps showing this session alone, exactly as before.

Measured on a real fan-out in this installation: the orchestrator's own spend was ¥1.089, its 18 children ¥3.158, the whole tree ¥4.247. The single-session figure was 26% of the bill.

## Pricing

Official DeepSeek prices per 1M tokens. Off-peak is listed first, peak hours cost exactly double:

| Model | Currency | Cache hit | Cache miss | Output |
|---|---|---|---|---|
| `deepseek-flash` | CNY | 0.02 / 0.04 | 1 / 2 | 4 / 8 |
| `deepseek-flash` | USD | 0.003 / 0.006 | 0.15 / 0.30 | 0.60 / 1.20 |
| `deepseek-v4-pro` | CNY | 0.15 / 0.30 | 4.5 / 9 | 13.5 / 27 |
| `deepseek-v4-pro` | USD | 0.022 / 0.044 | 0.66 / 1.32 | 1.98 / 3.96 |

Both price lists are kept natively, so a dollar wallet is not billed through a CNY conversion. The model family is detected from the routes recorded in the session.

**Peak** is 01:00–04:00 and 06:00–10:00 UTC on weekdays (09:00–12:00 and 14:00–18:00 Beijing time); everything else, including weekends, is off-peak. Chinese public holidays are not modelled — those days are priced as peak, i.e. deliberately on the safe side. The band is taken at render time, so a session spanning a peak boundary is estimated with one band.

## Settings

Two controls live on the settings page:

* **Local currency** — 60 common fiat currencies (RUB by default, KZT, BYN, EUR, GEL, AMD, TRY, AED, INR, JPY, KRW, …). Names come from `Intl.DisplayNames`, symbols from `Intl.NumberFormat`, so nothing is hardcoded per currency.
* **Session spend in** — `Local` (converted from the CNY price list at the live cross-rate, with the CNY equivalent shown in the tooltip) or `Top-up` (the currency of the largest wallet, CNY or USD, priced from its own official list).
* **Subagents** — `Whole tree` (default) counts every child agent; `This session` restores the orchestrator-only number.

All choices are stored in `localStorage`, per browser.

## Exchange rates

The yuan is the primary currency. Every provider is asked for a full "units per 1 ¥" table, so any of the listed currencies can be local. All providers are queried at once and the **first valid answer wins**; the rest are aborted.

| id | Endpoint |
|---|---|
| `cbr` | `cbr-xml-daily.ru/daily_json.js` — Bank of Russia, cross-rates derived from its table |
| `jsdelivr` | `cdn.jsdelivr.net/npm/@fawazahmed0/currency-api` |
| `erapi` | `open.er-api.com/v6/latest/CNY` |
| `fxratesapi` | `api.fxratesapi.com/latest?base=CNY` |
| `exchangerate` | `api.exchangerate-api.com/v4/latest/CNY` |
| `floatrates` | `floatrates.com/daily/cny.json` |

A payload is accepted only when `0.05 < $/¥ < 0.4`, it lists at least three currencies, and — when the rouble is present — `3 < ₽/¥ < 40`. The winning rate is cached for 6 hours, refreshed every 30 minutes and when the window regains focus; if the network is gone, the last known rate is shown with a “cached” marker. No rate is ever hardcoded.

## Where the balance comes from

Two transports, in order:

1. `ctx.remote.account.getBalance()` — the same authenticated channel the Settings → Account page uses. Note that a dynamic client plugin cannot reach it through `ctx.remote.account` (the sandbox proxies the service, not the namespace tree); `ctx.get('remote.account')` is the working path, and the plugin also tolerates the namespace mounting late.
2. A loopback route `/api-credits/balance` served by the Host half, guarded by a per-process token that the Host injects into the page it serves. Requests without the token get `403`.

Either way the balance never leaves your machine: the browser talks to your local DSH host, which talks to the DeepSeek platform with your own credentials.

The Host half serves one more route on the same guard: `/api-credits/spend?session=…` returns raw billing buckets per session in the tree. The browser prices them, so the currency logic and the price list stay in one place.

## Install

The repository root **is** the bundle, and the package is a normal pnpm dependency, so a GitHub ref and a local checkout both work. In Desktop, open the Plugin Manager and install it straight from the repository link — `https://github.com/extreme-russian-dsh-fandom/dsh-usage-credits` — or from a shell:

```bash
# from GitHub (append #<branch-or-commit> to pin a revision)
dsh plugin --profile <profile> add github:extreme-russian-dsh-fandom/dsh-usage-credits

# from a local checkout
dsh plugin --profile <profile> add C:\path\to\dsh-usage-credits
```

`github:` is pnpm's GitHub shorthand, not a DSH-specific scheme: `dsh plugin` forwards the arguments to pnpm, and the Plugin Manager's install path checks the repository with `git ls-remote` before running `pnpm add`. A Git dependency is versioned by the ref you name (or the default branch), so pin a tag, a commit, or the branch that carries the plugin when the default branch does not have it yet.

A local checkout is linked rather than copied, so `git pull` there reaches the running plugin after a page reload; a Git install is a fetched copy, and moving it to a newer ref means reinstalling.

The bundle patch inserts one row, `api-credits`. It has no dependencies and no build step: the Host half registers the token-guarded balance and spend routes, the Client half registers both dock pills and the Settings page.

Requires a signed-in DeepSeek account for the balance; without one the plugin shows a sign-in hint and still displays the rate.

## Layout

```
package.json        bundle manifest: dsh.bundle.patch + dsh.client
cordis.patch.yml    inserts the `api-credits` row
index.js            Host half: token-guarded balance and spend routes, index injection
spend.js            Host half: subagent tree aggregation (catalog walk, bucket fold, caches)
client.js           Client half: rate store, spend store, two dock pills, settings page
locale/{en,ru,zh}.json
icon.svg
test/spend.test.mjs unit tests for the tree aggregation
```

## Limitations

* Prices are a snapshot of the official price list; DeepSeek may change them. They live in one `PRICES` table in `client.js`.
* Peak-band estimation ignores Chinese public holidays and treats a session as if it ran entirely in the current band.
* External subagent providers (ACP, Codex, Claude Code) report no usage to DSH, so their cost cannot be counted; the tooltip labels them instead.
* A child whose log is gone — deleted, or an ephemeral caller-delivery workflow session — can only be counted while it is visible; the tooltip marks unavailable children.
* Trees larger than 300 agents or 6 levels deep are counted partially and labelled as truncated.
* Settings are stored per browser, not in the profile.
* Balance and spend are estimates for your own accounting; the authoritative number is the one Platform charges.

## License

MIT — see [LICENSE](LICENSE).

---

Русская версия: [README.ru.md](README.ru.md).

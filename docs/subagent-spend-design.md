# Учёт расхода субагентов в `@local/dsh-api-credits`

Статус: **реализовано** (этапы 1–3), проверено тестами и на реальных журналах.
Проект писался до реализации; разделы 6 и 13 приведены к тому, что реально в коде.
Проверено на установленной версии DSH `0.2.2-rc.3` (Desktop, профиль `desktop`), пакет плагина — версия `1.1.0`.

---

## 1. Вердикт

**Плагин не учитывает расход субагентов.** Пилл «Расход сессии» показывает только расход той
сессии, в которой открыт диалог, — расход агента-оркестратора. Расход всех дочерних агентов
(и их потомков) в сумму не попадает вообще.

Причина не в ошибке плагина, а в том, что он читает официальную проекцию `tokenUsage`,
которая по построению описывает **только собственный журнал одной сессии**:

* `client.js:1080` — `useProjection('tokenUsage')` без указания сессии (проекция привязанной сессии);
* `client.js:1084–1108` — весь пилл считается из этих четырёх бакетов;
* `client.js:513–522` — `sessionBuckets(usage)` раскладывает их в `fresh/write/hit/out`.

Субагент в DSH — это **отдельная сессия со своим журналом** (`subagent/*` в логе родителя только
фиксирует факт создания ребёнка, его имя и режим; цифр расхода там нет). Поэтому
`tokenUsage` родителя физически не может содержать расход детей — и не содержит.

На реальном журнале из этой же установки расхождение не «на несколько процентов»
(снимок 18.11.2026, ~21:30 по локальному времени; дерево в этот момент ещё работало):

| | токены | цена по тарифу flash, off-peak |
|---|---:|---:|
| сессия-оркестратор (свой расход) | 22 009 512 | ¥1.089 |
| 18 дочерних агентов | 38 411 413 | ¥3.158 |
| **всё дерево** | **60 420 925** | **¥4.247** |

Плагин сегодня показывает `−¥1.089` вместо `−¥4.247`, то есть **26 % реального расхода**;
дети дают 74 % счёта и тратят в 2.9 раза больше самого оркестратора. Это ровно тот сценарий,
который описан в задаче: оркестратор раздаёт задачи и выглядит «дешёвым», а платит
пользователь за дерево. Показательно и то, что за время разбора (21:23 → 21:30) собственное
число оркестратора выросло на ~19 %, а расход детей — на ~44 %: своё число тем хуже
аппроксимирует счёт, чем активнее идёт веерная раздача.

---

## 2. Что именно проверено и где это лежит в DSH

| Факт | Источник (установленный пакет) |
|---|---|
| `tokenUsage` — свёртка **одного** журнала; публичное значение = 4 бакета, без маршрутов | `@deepseek-ai/dsh-token-meter/src/usage-projection.ts`, `src/projection.ts` |
| Дочерние агенты — отдельные сессии, у родителя только `subagent/catalog` | `@deepseek-ai/dsh-subagent/src/catalog.ts` (v3), `README.md` |
| В `subagent/catalog` нет статуса выполнения и **нет токенов** — только `{id, mode, label, name, createdAt}` | `src/projection-types.ts` (`SubagentCatalogEntry`) |
| Каталог — клиент-видимая проекция (`wire`), т.е. список детей доступен в браузере | `src/catalog.ts:139` |
| Сессии субагентов попадают в общий список сессий с `origin: 'subagent'` и `parentSession` | `@deepseek-ai/dsh-api-session-controller/src/list.ts:372–382`, `src/types.ts:154–167` |
| Сводка строки списка несёт `tokenUsage` каждого ребёнка (summary-проекция) | `@deepseek-ai/dsh-session-projection/src/types.ts:57–73` |
| Host умеет читать проекции **чужой** сессии без активации агента | `ctx.sessionQuery.inspectSession(id, read)`, `@deepseek-ai/dsh-session-query/src/observation.ts:99` |
| Холодная сессия восстанавливается в память; кэш проекций засевает `observeSession`/`remote.projections`, а `inspectSession` (режим `projectionMode: 'none'`) считает заказанные юниты сам | `observation.ts:100`, `:179–189`, `:346–353` |
| Клиентский Remote `session.projections({sessionId})` тоже умеет читать чужую сессию | `@deepseek-ai/dsh-api-session-controller/src/history/controller.ts:69` |
| Свёртка проекции идёт по **всему** журналу, включая унаследованный форк-префикс | `@deepseek-ai/dsh-session-projection/src/index.ts:826–848` (`buildCell`), `:711` (`restore`) |
| Прецедент: UI субагентов сам суммирует `tokenUsage` детей | `@deepseek-ai/dsh-client-ui-subagent/README.md` («Token totals sum the four disjoint `tokenUsage` buckets») |

Проверка на живых данных: в `%USERPROFILE%\.dsh\sessions\...` лежат журналы
`session.v4.jsonl.zstd` (zstd, **много кадров** — обычный `zstdDecompressSync` читает только первый).
Сессия-оркестратор, наблюдавшаяся во время разбора: 10 детей на снимке 21:23, 18 — на 21:30,
и **ни одного** события с расходом детей в её журнале (только `subagent/catalog` и её
собственные `assistant/message`); расход каждого ребёнка лежит в его собственном журнале.
Скрипт-оракул — в приложении A.

---

## 3. Что должно получиться (требования)

1. Пилл показывает **расход всего дерева** сессии: свой + все потомки на любую глубину.
2. В подсказке видна расшифровка: свой расход, расход субагентов, итог; при желании — по агентам.
3. Если дерева нет — число **побайтово** совпадает с сегодняшним (никакой регрессии).
4. Если Host-агрегатор недоступен/упал — плагин молча показывает сегодняшнее число (свой расход).
5. Учёт переживает перезапуск: закрытые (холодные) дети тоже считаются.
6. Форк-дети не удваивают расход (см. §6.3) — это отдельный, обязательный пункт.
7. Внешние агенты (ACP / Codex / Claude Code) и потерянные журналы помечаются как
   **неизмеренные**, а не молча выпадают из суммы.
8. Ничего не опрашивается в фоне постоянно: обновление по событиям, а не по таймеру «навсегда».
9. Настройка «учитывать субагентов» (по умолчанию — да), локализация en/ru/zh.

---

## 4. Архитектура

Две половины, обе уже есть в пакете: Host (`index.js`, роут под `webServer`) и Client (`client.js`).

```
Client: SpendPill (sessionId из props слота)
  │  fetch GET /api-credits/spend?session=…&t=<token>   (тот же токен, что у баланса)
  ▼
Host (index.js): агрегатор дерева
  ctx.sessionQuery.inspectSession(id, session => ctx.sessionProjections.snapshot(session, KEYS))
  ├─ KEYS = { tokenUsage, subagentCatalog }
  ├─ рекурсия по subagentCatalog: continuable / one-shot / unknown
  ├─ external  → в список неизмеренных
  ├─ inheritedEventCount > 0 → вычесть унаследованный форк-префикс
  └─ кэш: 4 c на корень, 5 мин на холодный узел
  ▼ JSON: { own, agents[], totals, externals[], missing[], truncated, anyRunning }
Client: цена (существующие PRICES/sessionBuckets/spendValue) → пилл и подсказка
```

**Почему агрегация на Host, а не в браузере.** Вариант «суммировать сводки детей из списка сессий»
(`useSessions`) заманчив (ноль RPC), но:

* в сводке **нет** `inheritedEventCount` и `isSeeded`, поэтому форк-ребёнка нельзя ни
  распознать, ни скорректировать — а `subagent_fork` сеет ребёнка полной историей родителя,
  и его `tokenUsage` уже содержит расход родителя (см. §6.3). Сумма удвоится;
* холодные строки списка несут только кэш-подсказки (`cached`), которых может не быть —
  расход молча занизится;
* клиент стал бы вычислительным центром межсессионной агрегации, что противоречит контракту
  слоя проекций («the host is the only computation site», `projection-store.ts:1–14`).

Host же имеет ровно то, чего нет у клиента: `inheritedEventCount`, журнал и официальную
свёртку проекций. Поэтому считаем на Host, а клиенту отдаём готовые бакеты.

Альтернативы и причины отказа — в §12.

---

## 5. Контракт данных

`GET /api-credits/spend?session=<sessionId>&t=<token>` (токен — тот же, что инжектится в `</head>`).
Форма ответа (числа иллюстративные, кроме `own` — он из снимка §1):

```jsonc
{
  "ok": true,
  "sessionId": "session-39e20eb6-…",
  "at": 1795019000000,
  "asOfSeq": 814,
  "own":     { "uncachedInputTokens": 223355, "cacheWriteTokens": 0,
               "cacheReadTokens": 21678080, "outputTokens": 108077 },
  "agents": [                       // плоский список всех потомков, любой глубины
    { "id": "session-2f82e7bc-…", "parentId": "session-39e20eb6-…", "depth": 1,
      "name": "hp-audit", "label": "LAA audit HighPoly.dll", "mode": "continuable",
      "inherited": 0, "running": false,
      "usage": { "uncachedInputTokens": 0, "cacheWriteTokens": 0,
                 "cacheReadTokens": 0, "outputTokens": 0 } }
  ],
  "totals":  { "uncachedInputTokens": 0, "cacheWriteTokens": 0,
               "cacheReadTokens": 0, "outputTokens": 0 },   // own + Σ agents.usage
  "externals": [ { "id": "…", "name": "…", "label": "…" } ],  // без локального журнала
  "missing":   [ { "id": "…", "reason": "not-found" } ],      // журнал недоступен
  "truncated": false,
  "anyRunning": true
}
```

Правила:

* `agents[].usage` — **собственный** (биллинговый) расход узла: для обычной сессии —
  официальная `tokenUsage`, для форк-засеянной — свёртка только её собственного хвоста журнала.
  Именно он суммируется;
* `own` — то же для корня (для сессии без форка равен `tokenUsage`);
* `totals` считается на Host, чтобы клиент не мог случайно сложить `raw` вместо `usage`;
* деньги считает клиент: тариф, валюта, peak-фактор и курсы уже живут там (`PRICES`, `spendValue`);
* ошибки: `{ ok: false, reason: 'no-session-query' | 'no-session-projections' | 'read-failed' | 'bad-session' }`
  с HTTP 200 для бизнес-ошибок (как у баланса) — клиент просто остаётся на своём числе.

Ограничения: `MAX_NODES = 300`, `MAX_DEPTH = 6`, таймаут обхода 2.5 c. При превышении —
`truncated: true` и корректная (недосчитанная, но честно помеченная) сумма.

---

## 6. Алгоритм Host

### 6.1 Чтение одного узла

```js
const USAGE_KEYS = new Set(['tokenUsage', 'subagentCatalog']);

async function readNode(sessionId) {
  const query = ctx.get('sessionQuery');
  const projections = ctx.get('sessionProjections');
  if (query === undefined || projections === undefined) return null;

  return query.inspectSession(sessionId, (session) => {
    const snap = projections.snapshot(session, USAGE_KEYS);
    const inherited = Number(session.inheritedEventCount) || 0;
    const usage = inherited > 0
      ? foldUsage(session.ownEvents())          // только собственный хвост журнала
      : normalizeBuckets(snap.values.tokenUsage);
    return { asOfSeq: snap.asOfSeq, inherited, usage, catalog: snap.values.subagentCatalog ?? [] };
  });
}
```

* `inspectSession` **не активирует агента** и не делает вызовов модели; для холодной сессии
  он восстанавливает её из журнала и наш `snapshot(session, KEYS)` сворачивает два юнита
  по этому журналу (CPU, без дополнительного I/O — журнал уже прочитан). Кэш проекций в
  этом пути **не** используется, поэтому холодный узел кэшируется на 5 минут (см. §6.4),
  а нулевая по I/O альтернатива (`sessionProjectionCache.cachedSnapshot`) вынесена в этап 2;
* `snapshot(session, KEYS)` считает только два юнита — не весь набор клиент-видимых проекций;
* для живого ребёнка это O(1) (ячейка проекции уже идёт потоком), для холодного — один
  разбор журнала и одна свёртка.

### 6.2 Обход дерева

```js
for (const entry of catalog) {
  if (entry.mode === 'external') { externals.push({ id: entry.id, name: entry.name, label: entry.label }); continue; }
  if (depth >= MAX_DEPTH || nodes.length >= MAX_NODES) { truncated = true; break; }
  const child = await readNode(entry.id);          // ошибка → missing, не роняем весь ответ
  …
  await visit(entry.id, depth + 1);                // рекурсия: у ребёнка свой subagentCatalog
}
```

Читать по узлам, а не параллельно всем деревом: 300 параллельных чтений — это пик по I/O;
последовательный обход с ограничением даёт предсказуемую задержку, а кэш сглаживает повторные
запросы. Достаточно 3–4 конкурентных чтения на уровне.

### 6.3 Форк-дети: обязательная поправка

`subagent_fork` (и `@deepseek-ai/dsh-subagent-fork-in-process`) сеет ребёнка **префиксом журнала
родителя**. Ядро проекций сворачивает журнал целиком, включая унаследованный префикс
(`buildCell` → `session.snapshotEvents()`; `restore`/`hydrate` — от нулевого seq); у `tokenUsage`
нет проверки `inheritedEventCount` (в отличие от `subagentCatalog`, который такие факты исключает).
Следствие: `tokenUsage` форк-ребёнка в момент создания **равен** расходу родителя к моменту форка,
и простое суммирование удвоит историю.

Поэтому узел с `inheritedEventCount > 0` считается **только по собственному хвосту журнала**:

```
own = foldUsage(node.ownEvents())        // события начиная с inheritedEventCount
```

`Session.ownEvents()` — штатный аксессор «этой сессии после унаследованного префикса», так что
вычитать префикс из проекции не нужно. Это ещё и устойчивее: если в будущей версии DSH
`tokenUsage` сам начнёт исключать унаследованный префикс, формула «total − префикс» дала бы
двойное вычитание, а свёртка хвоста — нет. Граница форка — завершённый ход, поэтому
заменяющая семантика `foldUsage` через неё не ломается.

где `foldUsage` — плоская свёртка, повторяющая две документированные правила `token-meter`:

```js
function foldUsage(events, fromSeq = 0) {
  let totals = zero();
  let last = null;                          // { turn, step, buckets }
  for (const ev of events) {
    if (ev.seq < fromSeq) continue;
    if (ev.type === 'llm/retry-started') {  // ретрай в том же шаге — отдельная оплаченная попытка
      if (last && last.turn === ev.data.turn && last.step === ev.data.step) last = null;
      continue;
    }
    if (ev.type !== 'assistant/message' && ev.type !== 'assistant/attempt') continue;
    const usage = ev.data.usage ?? lastStreamUsage(ev.data.stream);
    if (!usage) continue;
    const buckets = {
      uncachedInputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: usage.cacheReadTokens ?? 0,
      cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    };
    if (last && last.turn === ev.data.turn && last.step === ev.data.step) totals = subtract(totals, last.buckets);
    totals = add(totals, buckets);
    last = { turn: ev.data.turn, step: ev.data.step, buckets };
  }
  return totals;
}
```

Дублирование 20 строк — сознательная цена: это **единственный** способ получить биллинговый
расход форк-ребёнка из официальных API. Ограничения:

* обычные сессии (`inheritedEventCount === 0`, т.е. все spawn/one-shot/workflow-дети)
  идут по официальной `tokenUsage` без собственной свёртки — расхождению с ядром взяться неоткуда;
* собственная свёртка включается только там, где официальная проекция принципиально неверна
  для биллинга (форк-префикс), и повторяет документированные правила `token-meter`; тест
  фиксирует их (замена сэмпла в попытке, `llm/retry-started`);
* в логах этой установки форк-сессий нет (`isSeeded=false` у всех просмотренных), поэтому пункт
  подтверждён чтением кода и синтетическим тестом, а не наблюдением.

### 6.4 Кэш и стоимость

| Что | TTL | Зачем |
|---|---|---|
| Ответ на корневую сессию | 4 c | дедупликация всплеска запросов при стриминге |
| Холодный узел (журнал закрытой сессии) | 5 мин | холодный ребёнок не меняется; журналы крупные |
| Живой узел | не кэшируем | ячейка проекции и так O(1) и всегда свежая |

Замер по этой установке: один журнал родителя — 716 КБ на диске и **2.8 МБ** после распаковки,
815 событий; 10 детей — сопоставимо. То есть первый обход холодного дерева — это единицы
мегабайт и десятки миллисекунд процессорного времени, но повторять его на каждый кадр нельзя.
Отсюда: кэш + обновление по событиям клиента (см. §7.2), а не «каждые 200 мс».

Дополнительная оптимизация, если замеры на больших деревьях окажутся плохими: для холодного
узла сначала `ctx.get('sessionProjectionCache').cachedSnapshot(header, USAGE_KEYS)`
(ноль I/O), и только при отсутствии ключа — `inspectSession`. Список заголовков берётся
одним `ctx.sessionQuery.listSessions()`. В проекте это «этап 2», не обязательный для первой версии.

---

## 7. Алгоритм клиента

### 7.1 Стор

Новый срез в `CreditStore` (рядом с балансом и курсами):

```js
// state.spend = { phase: 'idle'|'loading'|'ready'|'error', bySession: { [id]: payload }, diag }
async refreshSpend(sessionId, { force = false } = {}) {
  if (!sessionId) return;
  const token = window.__DSH_API_CREDITS_TOKEN__;
  if (!token) return;                                  // тихий фолбэк на tokenUsage
  const cached = this.state.spend.bySession[sessionId];
  if (!force && cached && Date.now() - cached.at < SPEND_TTL_MS) return;
  … fetch('/api-credits/spend?session=' + encodeURIComponent(sessionId) + '&t=' + token, { cache: 'no-store' })
  … this.emit({ spend: { … } });
}
```

Ошибки — только в `note()`/`diag` (как сейчас у баланса), UI не ломается.

### 7.2 Когда обновлять

Дешёвые и точные триггеры вместо таймера:

1. **Монтирование пилла / смена `sessionId`** — один запрос.
2. **`useProjection('subagentCatalog')`** — живая клиент-видимая проекция; при создании
   ребёнка её длина меняется, значит нужен новый обход. Это `useProjection` второго ключа,
   никакого нового API.
3. **`useSession(s => s.running)`** — переход `true → false` означает конец хода: дети,
   скорее всего, закрылись, число надо перечитать.
4. Пока в последнем ответе `anyRunning === true` — таймер 10 c; как только `false` — таймер
   снимается. Постоянного опроса нет.

### 7.3 Пилюля

`function SpendPill({ credits, t, useProjection, sessionId })` — `sessionId` уже приходит
стандартным пропом слота `conversation.composer.dock` (Session-scope).

```
−¥2.91            ← заголовок: totals (всё дерево), если есть дети; иначе — сегодняшнее число
└ подсказка:
   Расход сессии
   Новые входные   220K × ¥1.00/1M
   Cache hit       18.2M × ¥0.02/1M
   Выходные        92.6K × ¥4.00/1M
   Своя сессия                 ¥0.95
   ─────────
   Субагенты · 10              ¥1.96
     hp-audit                  ¥1.13
     06f08f3a                  ¥0.67
     … ещё 7
   ─────────
   Итого                       ¥2.91
   в юанях …            (если валюта ≠ CNY)
   Тариф deepseek-flash · off-peak
```

* цена каждого узла — существующий `spendValue`, чтобы сумма детей и своя часть считались по
  одной формуле: `sessionBuckets({ ...node.usage, routes: usage.routes }, Date.now())`;
* в списке — топ-5 детей по стоимости, остальные строкой «ещё N»;
* если `externals.length > 0` — строка «Внешние агенты не измеряются (N)»;
* если `missing.length > 0` — «Расход N дочерних сессий недоступен»;
* если `truncated` — «Учтены первые N агентов»;
* в пилле, когда дерево непустое, — маленький суффикс `+N` третичным цветом и
  `aria-label` вида «Расход сессии с субагентами: …»;
* настройка «только эта сессия» выключает агрегат (заголовок и подсказка — как сейчас).

Фолбэк: если `spend.phase !== 'ready'` — сегодняшний путь (`tokenUsage` привязанной сессии),
без индикатора ошибки.

### 7.4 Локализация

Новые ключи в `DICTS` (en/ru/zh):
`subagents`, `subagentsCount`, `sessionSubtotal`, `subagentsSubtotal`, `treeTotal`,
`externalUnmeasured`, `childLogsMissing`, `treeTruncated`, `includeSubagents`,
`onlyThisSession`, `spendWithSubagents`.

Числа подписываются отдельной строкой, а не склейкой падежей:
`label + ' · ' + n` — чтобы не тащить плюрализацию в словарь.

---

## 8. Настройки

В `CreditsSection` (рядом с «Расход сессии в») — сегмент:

`Учитывать субагентов` · `[Всё дерево] [Только эта сессия]`

Хранится в `localStorage` (`dsh.api-credits.tree-scope.v1`), как `spendMode`/`localCurrency`.
По умолчанию — «Всё дерево».

---

## 9. Краевые случаи

| Случай | Поведение |
|---|---|
| Сессия без детей | Ответ содержит `agents: []`; клиент показывает сегодняшнее число. Проверка «нет регрессии» — обязательна. |
| Внешний агент (ACP/Codex/Claude Code) | `externals[]`; в сумму не входит, помечается «не измеряется». Токенов в журнале DSH у него нет — принципиально. |
| `mode: 'unknown'` (историческая миграция) | Пробуем прочитать журнал; нет — `missing[]`. |
| Потерянный/битый журнал ребёнка | `missing[]`, сумма помечена как неполная, остальные узлы считаются. |
| `delivery: 'caller'` с эфемерной сессией (workflow) | Пока жива — считается как живой узел; после исчезновения — `missing`. Ограничение DSH, не плагина. |
| Внешний ребёнок с caller-delivery | В родительский каталог не попадает вовсе (`establishExternalCatalogChild` не вызывается) — увидеть его из лога родителя нельзя. |
| Форк-ребёнок | `usage` = `tokenUsage` минус унаследованный префикс. |
| Вложенные субагенты (depth > 1) | Рекурсия по каталогам; `depth` в ответе для подписи. |
| Дерево больше лимитов | `truncated: true`, честная подпись. |
| Нет `sessionQuery`/`sessionProjections` в профиле | `ok: false`, клиент молча остаётся на своём числе. |
| Роут опрашивают без токена/с мусорным `session` | 403 без токена; с мусорным id — 200 и `{ok:false, reason:'bad-session'}`; `sessionId` валидируется regex до обращения к сервисам |

---

## 10. Производительность, безопасность, совместимость

* **Рендер не блокируется**: пилл сразу рисует своё число, агрегат приходит вторым состоянием.
* **I/O**: только по запросу; кэш на Host; холодный узел не перечитывается 5 минут.
* **Плата за чтение чужих сессий — нулевая для модели**: `inspectSession` не активирует агента
  и не делает вызовов LLM. Это важно: агрегатор не должен «будить» субагентов.
* **Безопасность**: роут под тем же процессным токеном, что и баланс; отдаёт только числа,
  id, имена и метки каталога — никакого содержимого сообщений. Доверие то же, что у баланса
  (loopback-страница этой же установки). Валидировать `session` до обращения к сервисам.
* **Совместимость**: только публичные сервисы (`sessionQuery`, `sessionProjections`, `agents`
  для `anyRunning`) и публичные же проекции. Версия DSH в ответ не встраивается; при
  отсутствии сервисов — деградация, а не падение.

---

## 11. Риски

| Риск | Как снимаем |
|---|---|
| `tokenUsage` в будущем изменит семантику (например, сам начнёт исключать префикс) | форк-узлы считаются по `ownEvents()`, а не вычитанием из проекции: смена семантики их не касается; тест на синтетике фиксирует инвариант |
| `session.ownEvents()`/`snapshotEvents()` помечены deprecated в ядре | альтернатива без deprecated — `ctx.sessionQuery.observeSession(id)` (даёт `events`, `inheritedEventCount`, `projections`) с обязательным `dispose`; реализация использует `ownEvents()` через `inspectSession`, выбор зафиксирован комментарием в `spend.js` |
| Холодное дерево большого размера | кэш + лимиты + (этап 2) `sessionProjectionCache.cachedSnapshot` раньше чтения журнала |
| Клиент и Host разойдутся в трактовке `totals` | `totals` считает Host; клиент только раскладывает по ставкам |
| Двойной учёт при будущих fork-провайдерах с другим смещением префикса | `inheritedEventCount` — официальный «exact fork-inherited prefix length», другого источника нет |

---

## 12. Альтернативы и почему отклонены

1. **Суммировать сводки из `useSessions` (ноль RPC).**
   Нет `inheritedEventCount`/`isSeeded` → форк-дети удваивают историю; холодные строки могут
   не нести `tokenUsage`. Годится только как источник для «своего» числа.
2. **Клиентский `ctx.remote.session.projections({sessionId})` по каждому ребёнку.**
   Официальный и точный Remote, но по-прежнему без `inheritedEventCount` (значит форк не
   поправить), N RPC на дерево и полный набор клиент-видимых проекций в каждом ответе
   (`turnOutline` и т.п.). Допустимо как временный вариант, но не как целевой.
3. **Своя проекция `sessionProjections` с межсессионной суммой.**
   Контракт проекции — чистая синхронная свёртка **своего** журнала; читать другие сессии
   внутри `apply` нельзя. Для «своего» расхода с исключением префикса проекция годится
   (host-only ключ), но для агрегации — нет.
4. **Изменение ядра DSH** (например, `tokenUsage` с флагом `ignoreInherited`).
   Правильнее по сути, но требует форка/PR в DSH и не решает задачу в этом пакете.
   Зафиксировать как upstream-предложение — стоит.

---

## 13. Реализация

**Этап 1 — Host.** `spend.js` (агрегатор: `foldUsage`, `readNode`, обход каталога, кэши
дерева/узлов, лимиты) + роут `/api-credits/spend` в `index.js` под общим токеном и общей
JSON-обвязкой с балансом. Тесты — `test/spend.test.mjs` (`node --test test`).

**Этап 2 — Client.** Срез `spend`/`spendDiag` в сторе, `refreshSpend`, триггеры (§7.2),
пилл с суффиксом `+N` и расшифровкой, фолбэк на `tokenUsage`.

**Этап 3 — настройки и локализация.** Сегмент «Субагенты» в настройках, ключи en/ru/zh,
`README.md`/`README.ru.md`.

**Этап 4 (опционально) — точность тарификации** (см. §14): не реализовано.

### Что проверено

* `node --test test` — 12 тестов: правила свёртки (замена сэмпла, ретрай, stream-фолбэк),
  форк-префикс, обход дерева (вложенность, external, потерянный ребёнок), лимит глубины,
  кэши, отказ корня.
* Прогон агрегатора на **реальных** журналах этой установки через фейковый слой сервисов:
  дерево из 41 агента собрано целиком, `totals = own + Σ agents`, ошибок и пропусков нет
  (`own ¥1.251 + agents ¥5.900 = ¥7.151` на момент прогона).
* Headless-рендер клиентской пилюли (маленький React-стаб + прямой вызов компонента):
  режим дерева даёт `−¥2.92` и `+2`, режим «только эта» — прежние `−¥0.955`, отказ роута и
  пустое дерево возвращают прежнее число, пометки о потерянных/сокращённых детях на месте.

### Критерии готовности

* [x] Сессия с детьми: пилл = свой + Σ детей, сходится с агрегатором до бакета.
* [x] Сессия без детей: значение и подсказка идентичны текущим.
* [x] Роут недоступен/403: число = текущее, никакой ошибки в UI (только диагностика в настройках).
* [x] Форк-ребёнок (синтетический журнал с префиксом): сумма не удваивается.
* [x] Внешний агент: подпись «не измеряется», сумма без него.
* [x] Настройка «только эта сессия»: поведение как сегодня.
* [x] Живой ребёнок: обновление по `running`/каталогу, опрос 10 с только пока есть живые.
* [ ] en/ru/zh — проверить в живом UI после переустановки плагина (рендер-тест проверяет ключи).

### Тесты

* Юнит: `foldUsage` — ретрай в том же шаге добавляет вторую попытку; повторный сэмпл
  заменяет, а не складывается; `fromSeq` отсекает префикс.
* Контракт: разбор ответа роута на «нет детей», «ошибка ребёнка», «truncated».
* Интеграция: реальная сессия с детьми; сверка с оракулом (приложение A).

---

## 14. Отдельные дефекты тарификации (вне рамок задачи, но найдены при разборе)

Оба влияют на число **сильнее**, чем обсуждаемый учёт субагентов, поэтому фиксирую отдельно.

### 14.1 Тариф всегда flash

`priceFamily(usage)` (`client.js:507–510`) читает `usage.routes`, но проекция `tokenUsage`
**не содержит** `routes`: её публичное значение — строго четыре числовых поля
(`token-meter/src/usage-projection.ts:143`, `projection.ts:15–20`). Значит `models` всегда пуст,
регэксп `/pro/i` не срабатывает и любая сессия считается по **flash**:
`miss ¥1`, `output ¥4` вместо `miss ¥4.5`, `output ¥13.5` — недооценка до 4.5 раза на Pro-модели.

Механизм исправления: модель лежит на событии `assistant/message.data.message.source`
(`{kind:'model', provider, model}`), а также в `request/header.data.header.config.model`.
Точный вариант — считать по попыткам через `deriveTurnTokenUsage` (экспортируется как
`@deepseek-ai/dsh-token-meter/client`; в этой сборке `exports["./client"]` указывает на
`lib/types/client.js`), он даёт `routes` (`provider`/`model` по каждой оплаченной попытке) и
`reasoningTokens`; минимальный — Host отдаёт `models: string[]` в узле, клиент выбирает
семейство по ним.

### 14.2 Peak-фактор применяется ко всей истории

`isPeakHour(Date.now())` (`client.js:499–505`) и `factor = buckets.peak ? 2 : 1`
(`client.js:1089`) умножают **весь** накопленный расход на тариф текущего часа. Сессия,
шедшая ночью, после 06:00 UTC показывается вдвое дороже. С субагентами это заметнее
(дерево живёт дольше). Правильно — считать по времени каждой попытки
(`assistant/message.time` / `request/header`), т.е. теми же данными, что и §14.1.

Оба дефекта рационально закрывать одним изменением: Host отдаёт по узлу разбивку
`{family, peak, buckets}` вместо «сырых» бакетов, клиент складывает уже с учётом ставки.

---

## Приложение A. Оракул для проверки (Node ≥ 22, zstd)

Журналы DSH — zstd **с несколькими кадрами**; обычный `zstdDecompressSync` прочитает только
первый. Ниже — компактная проверка: собственный расход сессии, расход детей и сумма.

```js
// node oracle.js <session.v4.jsonl.zstd ...>
const fs = require('node:fs'), zlib = require('node:zlib')
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
function readLog(file) {
  const buf = fs.readFileSync(file); const starts = []; let from = 0
  for (;;) { const i = buf.indexOf(MAGIC, from); if (i < 0) break; starts.push(i); from = i + 4 }
  let text = ''
  for (let k = 0; k < starts.length; k++) {
    const end = k + 1 < starts.length ? starts[k + 1] : buf.length
    try { text += zlib.zstdDecompressSync(buf.subarray(starts[k], end)).toString('utf8') } catch {}
  }
  return text.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}
const zero = () => ({ fresh: 0, write: 0, hit: 0, out: 0 })
function fold(events, from = 0) {
  const t = zero(); let last = null
  for (const ev of events) {
    if (ev.seq < from) continue
    if (ev.type === 'llm/retry-started') { if (last && last.turn === ev.data.turn && last.step === ev.data.step) last = null; continue }
    const u = ev.type === 'assistant/message' ? ev.data.usage : undefined
    if (!u) continue
    const b = { fresh: u.inputTokens || 0, write: u.cacheWriteTokens || 0, hit: u.cacheReadTokens || 0, out: u.outputTokens || 0 }
    if (last && last.turn === ev.data.turn && last.step === ev.data.step) {
      for (const k in t) t[k] -= last.b[k]
    }
    for (const k in t) t[k] += b[k]
    last = { turn: ev.data.turn, step: ev.data.step, b }
  }
  return t
}
const sessions = new Map()
for (const file of process.argv.slice(2)) {
  const ev = readLog(file); const h = ev.find(e => e.type === 'session'); if (!h) continue
  sessions.set(h.id, { h, ev, usage: fold(ev), children: ev.filter(e => e.type === 'subagent/catalog').map(e => e.data.childId) })
}
const sum = t => t.fresh + t.write + t.hit + t.out
const price = t => (t.fresh + t.write) * 1e-6 + t.hit * 0.02e-6 + t.out * 4e-6   // flash, CNY, off-peak
for (const s of sessions.values()) {
  if (!s.children.length) continue
  const kids = s.children.map(id => sessions.get(id)).filter(Boolean)
  const kid = kids.reduce((a, k) => { for (const key in a) a[key] += k.usage[key]; return a }, zero())
  console.log('own', sum(s.usage), '¥' + price(s.usage).toFixed(3),
              '| kids', kids.length, sum(kid), '¥' + price(kid).toFixed(3),
              '| tree ¥' + (price(s.usage) + price(kid)).toFixed(3))
}
```

Запуск: `node oracle.js %USERPROFILE%\.dsh\sessions\<workspace>\session-*\session.v4.jsonl.zstd`.
Снимок §1 на 21:30 даёт `own ¥1.089 | kids 18 ¥3.158 | tree ¥4.247`; пока дерево живо,
числа растут, а у пользователя могут быть и другие деревья. Поэтому критерий приёмки —
**совпадение четырёх бакетов по каждому узлу** между роутом плагина и оракулом на один и тот же
момент, а не конкретная итоговая сумма.

Оговорка: скрипт читает `usage` только с `assistant/message` (в реальных журналах он есть
на каждом таком событии). Для полного повторения официальной семантики нужен ещё резервный
разбор `data.stream` — в проекте он обязателен (`lastStreamUsage`), в оракуле упрощён.

## Приложение B. Затронутые файлы

| Файл | Изменение |
|---|---|
| `index.js` | роут `/api-credits/spend`, общая JSON-обвязка с балансом, вызов агрегатора |
| `spend.js` | агрегатор: `foldUsage`, `readNode`, обход каталога, кэши, лимиты, `isSessionId` |
| `client.js` | срез `spend`/`spendDiag` в сторе, `refreshSpend`, триггеры, пилл/подсказка, суффикс `+N`, настройка, ключи локализации |
| `test/spend.test.mjs` | юнит-тесты агрегатора (`node --test test`) |
| `locale/*.json` | не менялись: строки UI живут в `DICTS` внутри `client.js` |
| `README.md`, `README.ru.md` | раздел о субагентах, роут расхода, структура, ограничения |
| `package.json` | `spend.js` в `files`, `./spend` в `exports`, скрипт `test` |

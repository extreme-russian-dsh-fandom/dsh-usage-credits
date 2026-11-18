window.__ModuleLoader__.load({
  id: 'dsh-usage-credits',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    let ReactDOM = null;
    try {
      ReactDOM = require('react-dom');
    } catch (error) {
      ReactDOM = null;
    }

    const NS = 'api-credits';
    const CACHE_KEY = 'dsh.api-credits.rates.v1';
    const LOCAL_KEY = 'dsh.api-credits.local-currency.v1';
    const SPEND_KEY = 'dsh.api-credits.spend-mode.v1';
    const TREE_KEY = 'dsh.api-credits.tree-scope.v1';
    const RATE_TTL_MS = 30 * 60 * 1000;
    const RATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    const ATTEMPT_TIMEOUT_MS = 4500;
    const RACE_DEADLINE_MS = 8000;
    const BALANCE_TTL_MS = 60 * 1000;
    const SPEND_TTL_MS = 4 * 1000;
    const SPEND_POLL_MS = 10 * 1000;
    const SPEND_KEEP = 20;

    //#region locale
    const DICTS = {
      en: {
        nav: 'API Credits',
        pillAria: 'API credit balance',
        toppedUp: 'Topped-up balance',
        rateSource: 'Rate source',
        updated: 'Updated',
        refresh: 'Refresh',
        signIn: 'Sign in to see your API credit balance.',
        unavailable: 'Balance unavailable right now.',
        rateUnavailable: 'Exchange rate unavailable — balances are shown without conversion.',
        loading: 'Loading…',
        cached: 'from cache',
        stale: 'rate is {hours} h old',
        failed: 'No rate provider answered.',
        unavailableProviders: 'Unavailable:',
        approx: 'approx.',
        fromCache: 'cached',
        spendAria: 'Session spend',
        sessionSpend: 'Session spend',
        tokensNew: 'New input',
        tokensWrite: 'Cache write',
        tokensHit: 'Cache hit',
        tokensOut: 'Output',
        total: 'Total',
        tariff: 'Tariff',
        peak: 'peak hours',
        offPeak: 'off-peak',
        inCny: 'in CNY',
        localCurrency: 'Local currency',
        spendIn: 'Session spend in',
        spendLocal: 'Local',
        spendTopUp: 'Top-up',
        subagents: 'Subagents',
        sessionSubtotal: 'This session',
        subagentsSubtotal: 'Subagents total',
        otherAgents: 'Other agents',
        externalUnmeasured: 'Not measured: external agents',
        childLogsMissing: 'Unavailable: child sessions',
        treeTruncated: 'Truncated: agent limit reached',
        includeSubagents: 'Whole tree',
        onlyThisSession: 'This session',
        spendWithSubagents: 'Session spend including subagents',
        treeScopeAria: 'Subagent spend accounting',
      },
      ru: {
        nav: 'API-кредиты',
        pillAria: 'Баланс API-кредитов',
        toppedUp: 'Пополненный баланс',
        rateSource: 'Источник курса',
        updated: 'Обновлено',
        refresh: 'Обновить',
        signIn: 'Войдите, чтобы увидеть баланс API-кредитов.',
        unavailable: 'Баланс сейчас недоступен.',
        rateUnavailable: 'Курс недоступен — балансы показаны без пересчёта.',
        loading: 'Загрузка…',
        cached: 'из кэша',
        stale: 'курсу {hours} ч',
        failed: 'Ни один источник курса не ответил.',
        unavailableProviders: 'Недоступны:',
        approx: 'примерно',
        fromCache: 'из кэша',
        spendAria: 'Расход сессии',
        sessionSpend: 'Расход сессии',
        tokensNew: 'Новые входные',
        tokensWrite: 'Запись в кэш',
        tokensHit: 'Cache hit',
        tokensOut: 'Выходные',
        total: 'Итого',
        tariff: 'Тариф',
        peak: 'peak-часы',
        offPeak: 'off-peak',
        inCny: 'в юанях',
        localCurrency: 'Локальная валюта',
        spendIn: 'Расход сессии в',
        spendLocal: 'Локальная',
        spendTopUp: 'Пополнение',
        subagents: 'Субагенты',
        sessionSubtotal: 'Своя сессия',
        subagentsSubtotal: 'Итого субагенты',
        otherAgents: 'Остальные агенты',
        externalUnmeasured: 'Не измеряются: внешние агенты',
        childLogsMissing: 'Недоступны: дочерние сессии',
        treeTruncated: 'Сокращено: достигнут лимит агентов',
        includeSubagents: 'Всё дерево',
        onlyThisSession: 'Только эта',
        spendWithSubagents: 'Расход сессии с субагентами',
        treeScopeAria: 'Учёт расхода субагентов',
      },
      zh: {
        nav: 'API 额度',
        pillAria: 'API 额度余额',
        toppedUp: '充值余额',
        rateSource: '汇率来源',
        updated: '更新于',
        refresh: '刷新',
        signIn: '登录后查看 API 额度余额。',
        unavailable: '暂时无法获取余额。',
        rateUnavailable: '汇率不可用——余额按原币种显示。',
        loading: '加载中…',
        cached: '来自缓存',
        stale: '汇率已过去 {hours} 小时',
        failed: '所有汇率来源均未响应。',
        unavailableProviders: '不可用：',
        approx: '约',
        fromCache: '缓存',
        spendAria: '会话消耗',
        sessionSpend: '会话消耗',
        tokensNew: '新增输入',
        tokensWrite: '缓存写入',
        tokensHit: '缓存命中',
        tokensOut: '输出',
        total: '合计',
        tariff: '价目',
        peak: '高峰时段',
        offPeak: '空闲时段',
        inCny: '折合人民币',
        localCurrency: '本地货币',
        spendIn: '会话消耗显示为',
        spendLocal: '本地货币',
        spendTopUp: '充值货币',
        subagents: '子代理',
        sessionSubtotal: '本会话',
        subagentsSubtotal: '子代理合计',
        otherAgents: '其他代理',
        externalUnmeasured: '未计量：外部代理',
        childLogsMissing: '不可用：子会话',
        treeTruncated: '已截断：达到代理上限',
        includeSubagents: '整棵树',
        onlyThisSession: '仅本会话',
        spendWithSubagents: '会话消耗（含子代理）',
        treeScopeAria: '子代理消耗统计',
      },
    };
    //#endregion

    //#region rate providers
    const num = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    /** Fiat codes offered as the local currency; every provider publishes these. */
    const LOCAL_CURRENCIES = [
      'RUB', 'USD', 'EUR', 'KZT', 'BYN', 'UAH', 'GEL', 'AMD', 'AZN', 'TRY',
      'AED', 'ILS', 'INR', 'JPY', 'KRW', 'GBP', 'CHF', 'CAD', 'AUD', 'BRL',
      'MXN', 'SGD', 'HKD', 'THB', 'VND', 'IDR', 'MYR', 'PHP', 'PLN', 'CZK',
      'SEK', 'NOK', 'DKK', 'ZAR', 'EGP', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR',
      'JOD', 'TND', 'MAD', 'NGN', 'KES', 'PKR', 'BDT', 'LKR', 'NPR', 'MNT',
      'UZS', 'KGS', 'TJS', 'TMT', 'MDL', 'RSD', 'BGN', 'RON', 'HUF', 'ISK',
    ];

    const DEFAULT_LOCAL_CURRENCY = 'RUB';

    /** Keep only positive finite ISO-code quotes from a raw `{code: unitsPerCny}` table. */
    function normalizeRates(source) {
      const rates = {};
      for (const [key, raw] of Object.entries(source || {})) {
        if (typeof key !== 'string') continue;
        const code = key.toUpperCase();
        if (!/^[A-Z]{3}$/.test(code)) continue;
        const value = num(raw);
        if (value > 0) rates[code] = value;
      }
      return rates;
    }

    /** Per-CNY quote table: `{ usdPerCny, rates: { USD, RUB, EUR, … } }`. */
    const parsePerCny = (json) => {
      const source = json && json.rates;
      if (!source || typeof source !== 'object') return null;
      return { usdPerCny: num(source.USD), rates: normalizeRates(source) };
    };

    const PROVIDERS = [
      {
        id: 'cbr',
        url: 'https://www.cbr-xml-daily.ru/daily_json.js',
        host: 'cbr-xml-daily.ru',
        label: { en: 'Bank of Russia', ru: 'ЦБ РФ', zh: '俄罗斯央行' },
        parse(json) {
          const valute = json && json.Valute;
          if (!valute || !valute.CNY || !valute.USD) return null;
          const rubPerCny = num(valute.CNY.Value) / (num(valute.CNY.Nominal) || 1);
          const rubPerUsd = num(valute.USD.Value) / (num(valute.USD.Nominal) || 1);
          if (!(rubPerCny > 0) || !(rubPerUsd > 0)) return null;
          // The CB table quotes roubles per unit, so cross-rate each listed currency.
          const rates = {};
          for (const [code, entry] of Object.entries(valute)) {
            const rubPerUnit = num(entry && entry.Value) / (num(entry && entry.Nominal) || 1);
            if (rubPerUnit > 0) rates[code] = rubPerCny / rubPerUnit;
          }
          rates.RUB = rubPerCny;
          return { usdPerCny: rubPerCny / rubPerUsd, rates };
        },
      },
      {
        id: 'jsdelivr',
        url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cny.json',
        host: 'cdn.jsdelivr.net',
        label: { en: 'currency-api (jsDelivr)', ru: 'currency-api (jsDelivr)', zh: 'currency-api (jsDelivr)' },
        parse(json) {
          const table = json && json.cny;
          if (!table || typeof table !== 'object') return null;
          return { usdPerCny: num(table.usd), rates: normalizeRates(table) };
        },
      },
      {
        id: 'erapi',
        url: 'https://open.er-api.com/v6/latest/CNY',
        host: 'open.er-api.com',
        label: { en: 'open.er-api.com', ru: 'open.er-api.com', zh: 'open.er-api.com' },
        parse: parsePerCny,
      },
      {
        id: 'fxratesapi',
        url: 'https://api.fxratesapi.com/latest?base=CNY',
        host: 'api.fxratesapi.com',
        label: { en: 'fxratesapi.com', ru: 'fxratesapi.com', zh: 'fxratesapi.com' },
        parse: parsePerCny,
      },
      {
        id: 'exchangerate',
        url: 'https://api.exchangerate-api.com/v4/latest/CNY',
        host: 'api.exchangerate-api.com',
        label: { en: 'exchangerate-api.com', ru: 'exchangerate-api.com', zh: 'exchangerate-api.com' },
        parse: parsePerCny,
      },
      {
        id: 'floatrates',
        url: 'https://www.floatrates.com/daily/cny.json',
        host: 'floatrates.com',
        label: { en: 'floatrates.com', ru: 'floatrates.com', zh: 'floatrates.com' },
        parse(json) {
          if (!json || typeof json !== 'object') return null;
          const rates = {};
          for (const [code, entry] of Object.entries(json)) {
            const rate = num(entry && entry.rate);
            if (rate > 0) rates[code.toUpperCase()] = rate;
          }
          if (!(rates.USD > 0)) return null;
          return { usdPerCny: rates.USD, rates };
        },
      },
    ];

    const PROVIDER_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

    /** Sane bounds reject truncated, inverted, or placeholder payloads. */
    function validRate(rate) {
      if (!rate) return false;
      const usd = rate.usdPerCny;
      if (!Number.isFinite(usd) || usd <= 0.05 || usd >= 0.4) return false;
      if (!rate.rates || typeof rate.rates !== 'object') return false;
      if (Object.keys(rate.rates).length < 3) return false;
      const rub = rate.rates.RUB;
      if (rub !== undefined && (!Number.isFinite(rub) || rub <= 3 || rub >= 40)) return false;
      return true;
    }

    function providerLabel(id, language) {
      const provider = PROVIDER_BY_ID.get(id);
      if (!provider) return id;
      return provider.label[language] || provider.label.en;
    }

    /**
     * Hedge every provider at once and resolve with the first valid answer.
     * A slow but preferred source loses to a fast one, which is the requested
     * behaviour; the loser list still reaches the tooltip through `onStatus`.
     */
    function raceProviders(onStatus) {
      const settled = { done: false };
      const report = (id, status) => {
        if (!settled.done) onStatus(id, status);
      };
      const deadline = new AbortController();
      const deadlineTimer = setTimeout(() => deadline.abort(), RACE_DEADLINE_MS);
      const attemptTimers = [];

      const attempts = PROVIDERS.map((provider) => {
        const controller = new AbortController();
        const onDeadline = () => controller.abort();
        deadline.signal.addEventListener('abort', onDeadline, { once: true });
        attemptTimers.push(setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS));
        report(provider.id, 'pending');
        return fetch(provider.url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
          .then((response) => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then((json) => {
            const parsed = provider.parse(json);
            if (!validRate(parsed)) throw new Error('invalid payload');
            return {
              provider: provider.id,
              usdPerCny: parsed.usdPerCny,
              rates: parsed.rates,
              at: Date.now(),
            };
          })
          .then((rate) => {
            report(provider.id, 'ok');
            return rate;
          })
          .catch((error) => {
            report(provider.id, deadline.signal.aborted ? 'timeout' : 'failed');
            throw error;
          });
      });

      const cleanup = () => {
        clearTimeout(deadlineTimer);
        for (const timer of attemptTimers) clearTimeout(timer);
        deadline.abort();
      };

      return new Promise((resolve, reject) => {
        let pending = attempts.length;
        attempts.forEach((attempt) => {
          attempt.then(
            (rate) => {
              if (settled.done) return;
              settled.done = true;
              cleanup();
              resolve(rate);
            },
            () => {
              pending -= 1;
              if (pending === 0 && !settled.done) {
                settled.done = true;
                cleanup();
                reject(new Error('no provider answered'));
              }
            },
          );
        });
      });
    }
    //#endregion

    //#region formatting
    function languageOf(ctx) {
      try {
        return ctx.locale.getSnapshot().active || 'en';
      } catch (error) {
        return 'en';
      }
    }

    function localeTagOf(ctx) {
      const language = languageOf(ctx);
      return language === 'zh' ? 'zh-CN' : language === 'ru' ? 'ru-RU' : 'en-US';
    }

    /**
     * Money uses a dot decimal separator and comma grouping in every locale:
     * `¥12.34 ($1.85, 151 ₽)` reads unambiguously, while a local decimal comma
     * would collide with the comma separating the bracketed values.
     */
    function groupNumber(value, digits, localeTag) {
      try {
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value);
      } catch (error) {
        return Number(value).toFixed(digits);
      }
    }

    const SYMBOL_CACHE = new Map();

    /** Narrow currency symbol via Intl; the ISO code is the honest fallback. */
    function currencySymbol(code, localeTag) {
      if (SYMBOL_CACHE.has(code)) return SYMBOL_CACHE.get(code);
      let symbol = code;
      try {
        const parts = new Intl.NumberFormat(localeTag || 'en-US', {
          style: 'currency',
          currency: code,
          currencyDisplay: 'narrowSymbol',
        }).formatToParts(0);
        const found = parts.find((part) => part.type === 'currency');
        if (found && found.value) symbol = found.value;
      } catch (error) {
        symbol = code;
      }
      // `¥` and `$` are shared by several currencies; keep the plugin's primary
      // yuan/dollar glyphs unambiguous by naming the other one by its code.
      if (symbol === '¥' && code !== 'CNY') symbol = code;
      if (symbol === '$' && code !== 'USD') symbol = code;
      SYMBOL_CACHE.set(code, symbol);
      return symbol;
    }

    /** Localized currency name for the settings picker. */
    function currencyName(code, language) {
      const tag = language === 'zh' ? 'zh-CN' : language === 'ru' ? 'ru-RU' : 'en-US';
      try {
        const names = new Intl.DisplayNames([tag], { type: 'currency' });
        return names.of(code) || code;
      } catch (error) {
        return code;
      }
    }

    /**
     * Money uses a dot decimal separator and comma grouping in every locale:
     * `¥12.34 ($1.85, 151 ₽)` reads unambiguously, while a local decimal comma
     * would collide with the comma separating the bracketed values.
     */
    function groupNumber(value, digits, localeTag) {
      try {
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value);
      } catch (error) {
        return Number(value).toFixed(digits);
      }
    }

    /**
     * Balance amounts: the two plugin currencies keep their prefix glyphs, every
     * other local currency prints as a suffix (`151 ₽`, `1,234 ₸`) with cents
     * only while the amount is small enough for them to matter.
     */
    function formatMoney(value, currency, localeTag) {
      if (value === null || value === undefined || !Number.isFinite(value)) return '';
      const digits = currency === 'CNY' || currency === 'USD' ? 2 : value >= 100 ? 0 : 2;
      const text = groupNumber(value, digits, localeTag);
      if (currency === 'CNY') return '¥' + text;
      if (currency === 'USD') return '$' + text;
      return text + ' ' + currencySymbol(currency, localeTag);
    }

    /** Session costs stay readable far below one unit, so precision follows magnitude. */
    function formatCost(value, currency, localeTag) {
      const safe = Number.isFinite(value) && value > 0 ? value : 0;
      const digits = safe >= 1 ? 2 : safe >= 0.01 ? 3 : 4;
      const amount = groupNumber(safe, digits, localeTag);
      if (currency === 'CNY') return '¥' + amount;
      if (currency === 'USD') return '$' + amount;
      return amount + ' ' + currencySymbol(currency, localeTag);
    }

    function formatTime(at, localeTag) {
      try {
        return new Date(at).toLocaleString(localeTag, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (error) {
        return new Date(at).toISOString();
      }
    }

    function formatAge(at) {
      const minutes = Math.max(1, Math.round((Date.now() - at) / 60000));
      if (minutes < 60) return minutes + ' min';
      return Math.round(minutes / 60) + ' h';
    }

    /** Wallet text in the source currencies, joined the way the account card joins them. */
    function walletsText(wallets, localeTag) {
      return wallets
        .map((wallet) => formatMoney(Number(wallet.balance), wallet.currency, localeTag))
        .filter(Boolean)
        .join(' + ');
    }

    /** Short text for a failed RemoteResult: error code plus message when present. */
    function describeFailure(result) {
      if (!result) return 'no result';
      const failure = result.error;
      if (!failure) return 'not ok';
      return String(failure.code || 'remote-error') + (failure.message ? ': ' + failure.message : '');
    }

    function describeError(error) {
      if (!error) return 'unknown error';
      return String(error.name || 'Error') + (error.message ? ': ' + error.message : '');
    }

    //#region session pricing
    /**
     * Official DeepSeek price list per 1M tokens at OFF-PEAK, in both currencies
     * the platform bills in; peak hours cost exactly double. Cache reads are why
     * a naive "tokens × price" figure explodes: a hit is 50x cheaper than a miss.
     */
    const PRICES = {
      flash: {
        id: 'deepseek-flash',
        CNY: { hit: 0.02, miss: 1, output: 4 },
        USD: { hit: 0.003, miss: 0.15, output: 0.6 },
      },
      pro: {
        id: 'deepseek-v4-pro',
        CNY: { hit: 0.15, miss: 4.5, output: 13.5 },
        USD: { hit: 0.022, miss: 0.66, output: 1.98 },
      },
    };

    /** Peak runs 01:00-04:00 and 06:00-10:00 UTC, Monday through Friday. */
    function isPeakHour(now) {
      const date = new Date(now);
      const day = date.getUTCDay();
      if (day === 0 || day === 6) return false;
      const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
      return (minutes >= 60 && minutes < 240) || (minutes >= 360 && minutes < 600);
    }

    function priceFamily(usage) {
      const models = ((usage && usage.routes) || []).map((route) => String((route && route.model) || '')).join(' ');
      return /pro/i.test(models) ? 'pro' : 'flash';
    }

    /** Whole-log usage folded into its disjoint billing buckets. */
    function sessionBuckets(usage, now) {
      return {
        family: priceFamily(usage),
        peak: isPeakHour(now),
        fresh: Number(usage.uncachedInputTokens) || 0,
        write: Number(usage.cacheWriteTokens) || 0,
        hit: Number(usage.cacheReadTokens) || 0,
        out: Number(usage.outputTokens) || 0,
      };
    }

    /** Price the buckets with one currency table; `factor` doubles for peak. */
    function spendValue(buckets, table, factor) {
      return (((buckets.fresh + buckets.write) * table.miss + buckets.hit * table.hit + buckets.out * table.output) / 1e6) * factor;
    }

    function compactTokens(value) {
      if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
      if (value >= 1e3) return Math.round(value / 1e3) + 'K';
      return String(value);
    }

    /** One agent's readable label: its name, its catalog label, then a short id. */
    function agentLabel(agent) {
      if (agent && typeof agent.name === 'string' && agent.name !== '') return agent.name;
      if (agent && typeof agent.label === 'string' && agent.label !== '') return agent.label;
      const id = agent && typeof agent.id === 'string' ? agent.id : '';
      return id.indexOf('session-') === 0 ? id.slice(8, 16) : id.slice(0, 8);
    }

    /** Fold every child's four buckets into one raw usage object. */
    function foldAgentUsage(agents) {
      const total = { uncachedInputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
      for (const agent of agents || []) {
        const usage = agent && agent.usage;
        if (!usage) continue;
        total.uncachedInputTokens += Number(usage.uncachedInputTokens) || 0;
        total.cacheWriteTokens += Number(usage.cacheWriteTokens) || 0;
        total.cacheReadTokens += Number(usage.cacheReadTokens) || 0;
        total.outputTokens += Number(usage.outputTokens) || 0;
      }
      return total;
    }
    //#endregion

    /** The wallet the account tops up in: its largest one, CNY on a tie. */
    function topUpCurrency(state) {
      let code = 'CNY';
      let best = -1;
      for (const wallet of state.wallets || []) {
        const value = Number(wallet.balance) || 0;
        if (value > best) {
          best = value;
          code = wallet.currency === 'USD' ? 'USD' : 'CNY';
        }
      }
      return code;
    }

    /**
     * Fold wallets into the plugin's primary currency (CNY): the USD wallet is
     * converted at the live rate, then USD and the chosen local currency are
     * derived from that total.
     */
    function derive(state) {
      const wallets = (state.wallets || []).filter((wallet) => Number.isFinite(Number(wallet.balance)));
      if (wallets.length === 0) return null;
      let cnyAmount = 0;
      let usdAmount = 0;
      for (const wallet of wallets) {
        const value = Number(wallet.balance);
        if (wallet.currency === 'CNY') cnyAmount += value;
        else if (wallet.currency === 'USD') usdAmount += value;
      }
      const rate = state.rate;
      const localCode = state.localCurrency || DEFAULT_LOCAL_CURRENCY;
      const rawLocal = rate && rate.rates ? rate.rates[localCode] : undefined;
      const localRate = Number.isFinite(rawLocal) && rawLocal > 0 ? rawLocal : null;
      if (!rate) {
        return { wallets, cnyAmount, usdAmount, cny: null, usd: null, local: null, localRate, localCode };
      }
      const cny = cnyAmount + (rate.usdPerCny > 0 ? usdAmount / rate.usdPerCny : 0);
      return {
        wallets,
        cnyAmount,
        usdAmount,
        cny,
        usd: cny * rate.usdPerCny,
        local: localRate === null ? null : cny * localRate,
        localRate,
        localCode,
      };
    }
    //#endregion

    //#region store
    class CreditStore {
      constructor(ctx) {
        this.ctx = ctx;
        this.remote = null;
        this.remoteBroken = false;
        this.diags = [];
        this.listeners = new Set();
        this.timers = new Set();
        this.rateInFlight = null;
        this.balanceInFlight = null;
        this.spendInFlight = new Map();
        this.onWindowFocus = () => {
          this.refreshRates(false);
          this.refreshBalance();
        };
        this.onVisibility = () => {
          if (document.visibilityState === 'visible') this.onWindowFocus();
        };
        this.state = {
          wallets: [],
          balancePhase: 'loading',
          balanceSource: null,
          balanceDiag: '',
          rate: null,
          ratePhase: 'idle',
          providerStatus: {},
          localCurrency: DEFAULT_LOCAL_CURRENCY,
          spendMode: 'topup',
          treeScope: 'tree',
          spend: {},
          spendDiag: '',
        };
        this.subscribe = (listener) => {
          this.listeners.add(listener);
          return () => {
            this.listeners.delete(listener);
          };
        };
        this.getSnapshot = () => this.state;
      }

      language() {
        return languageOf(this.ctx);
      }

      localeTag() {
        return localeTagOf(this.ctx);
      }

      emit(patch) {
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) listener();
      }

      start() {
        this.emit(this.readPrefs());
        const cached = this.readCache();
        if (cached) this.emit({ rate: cached, ratePhase: 'cached' });
        this.refreshRates(!cached);
        if (typeof window !== 'undefined') {
          window.addEventListener('focus', this.onWindowFocus);
          if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.onVisibility);
          }
        }
        this.timers.add(setInterval(() => this.refreshRates(false), RATE_TTL_MS));
        this.timers.add(setInterval(() => this.refreshBalance(), BALANCE_TTL_MS));
        this.resolveAccount();
        // A profile without the account remote never resolves; surface that
        // instead of an endless "Loading…".
        this.timers.add(
          setTimeout(() => {
            if (this.state.balancePhase === 'loading') this.note('no balance transport answered');
          }, 8000),
        );
      }

      /** The namespace mounts during boot, so poll instead of trusting one inject moment. */
      async resolveAccount() {
        for (let attempt = 0; attempt < 24; attempt += 1) {
          if (this.remote) return;
          const account = this.ctx.get ? this.ctx.get('remote.account') : undefined;
          if (account && typeof account.getBalance === 'function') {
            this.attachRemote(account);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        // No namespace at all: fall through to the Host route immediately.
        this.refreshBalance();
      }

      attachRemote(account) {
        if (!account || this.remote === account) return;
        this.remote = account;
        this.refreshBalance();
      }

      refreshAll() {
        this.refreshRates(true);
        this.refreshBalance();
      }

      /** The local currency, the spend-currency choice, and the tree scope survive reloads. */
      readPrefs() {
        try {
          const local = window.localStorage.getItem(LOCAL_KEY);
          const mode = window.localStorage.getItem(SPEND_KEY);
          const tree = window.localStorage.getItem(TREE_KEY);
          return {
            localCurrency: LOCAL_CURRENCIES.includes(local) ? local : DEFAULT_LOCAL_CURRENCY,
            spendMode: mode === 'local' ? 'local' : 'topup',
            treeScope: tree === 'self' ? 'self' : 'tree',
          };
        } catch (error) {
          return { localCurrency: DEFAULT_LOCAL_CURRENCY, spendMode: 'topup', treeScope: 'tree' };
        }
      }

      setLocalCurrency(code) {
        if (!LOCAL_CURRENCIES.includes(code) || code === this.state.localCurrency) return;
        this.emit({ localCurrency: code });
        try {
          window.localStorage.setItem(LOCAL_KEY, code);
        } catch (error) {
          /* storage disabled: the choice still applies for this page */
        }
        const rate = this.state.rate;
        if (!rate || !rate.rates || !(rate.rates[code] > 0)) this.refreshRates(true);
      }

      setSpendMode(mode) {
        const next = mode === 'local' ? 'local' : 'topup';
        if (next === this.state.spendMode) return;
        this.emit({ spendMode: next });
        try {
          window.localStorage.setItem(SPEND_KEY, next);
        } catch (error) {
          /* storage disabled: the choice still applies for this page */
        }
      }

      /** Whether the pill prices the whole subagent tree or this session alone. */
      setTreeScope(scope) {
        const next = scope === 'self' ? 'self' : 'tree';
        if (next === this.state.treeScope) return;
        this.emit({ treeScope: next });
        try {
          window.localStorage.setItem(TREE_KEY, next);
        } catch (error) {
          /* storage disabled: the choice still applies for this page */
        }
      }

      /**
       * Read the Host's tree aggregate for one Session. The reply carries raw
       * buckets per node; money stays a Client concern. Failures leave the pill
       * on its own `tokenUsage` readout and are surfaced only as a diagnostic.
       */
      refreshSpend(sessionId, force) {
        if (!sessionId) return Promise.resolve();
        const inflight = this.spendInFlight.get(sessionId);
        if (inflight !== undefined) return inflight;
        const cached = this.state.spend[sessionId];
        if (force !== true && cached !== undefined && Date.now() - cached.at < SPEND_TTL_MS) {
          return Promise.resolve();
        }
        const run = (async () => {
          try {
            const token = typeof window !== 'undefined' ? window.__DSH_API_CREDITS_TOKEN__ : undefined;
            if (!token) return;
            const query = new URLSearchParams({ t: token, session: sessionId });
            const response = await fetch('/api-credits/spend?' + query.toString(), { cache: 'no-store' });
            if (!response.ok) {
              this.emit({ spendDiag: 'spend: HTTP ' + response.status });
              return;
            }
            const payload = await response.json();
            if (!payload || payload.ok !== true) {
              this.emit({ spendDiag: 'spend: ' + (payload && payload.reason ? payload.reason : 'failed') });
              return;
            }
            const spend = { ...this.state.spend, [sessionId]: { at: Date.now(), payload } };
            const ids = Object.keys(spend);
            if (ids.length > SPEND_KEEP) {
              ids
                .sort((left, right) => (spend[left].at || 0) - (spend[right].at || 0))
                .slice(0, ids.length - SPEND_KEEP)
                .forEach((id) => delete spend[id]);
            }
            this.emit({ spend, spendDiag: '' });
          } catch (error) {
            this.emit({ spendDiag: 'spend: ' + describeError(error) });
          } finally {
            this.spendInFlight.delete(sessionId);
          }
        })();
        this.spendInFlight.set(sessionId, run);
        return run;
      }

      readCache() {
        try {
          const raw = window.localStorage.getItem(CACHE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!validRate(parsed)) return null;
          if (!Number.isFinite(parsed.at) || Date.now() - parsed.at > RATE_MAX_AGE_MS) return null;
          if (!PROVIDER_BY_ID.has(parsed.provider)) return null;
          return parsed;
        } catch (error) {
          return null;
        }
      }

      writeCache(rate) {
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(rate));
        } catch (error) {
          /* storage disabled: the in-memory rate still works */
        }
      }

      refreshRates(force) {
        if (this.rateInFlight) return this.rateInFlight;
        const current = this.state.rate;
        if (!force && current && Date.now() - current.at < RATE_TTL_MS) return Promise.resolve(current);
        this.emit({
          ratePhase: current ? (Date.now() - current.at >= RATE_TTL_MS ? 'cached' : 'refreshing') : 'loading',
        });
        const onStatus = (id, status) => {
          this.emit({ providerStatus: { ...this.state.providerStatus, [id]: status } });
        };
        this.rateInFlight = raceProviders(onStatus)
          .then((rate) => {
            this.writeCache(rate);
            this.emit({ rate, ratePhase: 'ready' });
            return rate;
          })
          .catch(() => {
            this.emit({ ratePhase: this.state.rate ? 'stale' : 'failed' });
            return null;
          })
          .finally(() => {
            this.rateInFlight = null;
          });
        return this.rateInFlight;
      }

      clientMeta() {
        return {
          version: '1.0.0',
          locale: this.language(),
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
        };
      }

      /** Record why one transport failed; the Settings page shows the whole chain. */
      note(text) {
        console.warn('[api-credits]', text);
        this.diags.push(text);
        this.emit({
          balanceDiag: this.diags.join(' | '),
          balancePhase: this.state.balancePhase === 'loading' ? 'error' : this.state.balancePhase,
        });
      }

      applyWallets(list, source) {
        const wallets = (list || []).map((wallet) => ({
          currency: wallet.currency,
          balance: String(wallet.balance),
        }));
        this.emit({
          wallets,
          balancePhase: wallets.length > 0 ? 'ready' : 'empty',
          balanceSource: source,
          balanceDiag: '',
        });
      }

      refreshBalance() {
        if (this.balanceInFlight) return this.balanceInFlight;
        this.balanceInFlight = (async () => {
          this.diags = [];
          try {
            if (this.remote && !this.remoteBroken) {
              const served = await this.readRemoteBalance();
              if (served) return;
              this.remoteBroken = true;
            }
            await this.readRouteBalance();
          } finally {
            this.balanceInFlight = null;
          }
        })();
        return this.balanceInFlight;
      }

      async readRemoteBalance() {
        if (!this.remote) return false;
        try {
          const result = await this.remote.getBalance(this.clientMeta());
          if (!result || result.ok !== true) {
            this.note('remote: ' + describeFailure(result));
            return false;
          }
          const details = result.value;
          if (details === null || details === undefined) {
            this.emit({ wallets: [], balancePhase: 'signed-out', balanceSource: 'remote', balanceDiag: '' });
            return true;
          }
          if (details.status !== 'ready') {
            this.note('remote: balance ' + details.status);
            return false;
          }
          this.applyWallets(details.value, 'remote');
          return true;
        } catch (error) {
          this.note('remote: ' + describeError(error));
          return false;
        }
      }

      /** Fallback transport: the Host route, guarded by the token the Host injected. */
      async readRouteBalance() {
        const token = typeof window !== 'undefined' ? window.__DSH_API_CREDITS_TOKEN__ : undefined;
        if (!token) {
          this.note('route: token missing');
          this.emit({ balancePhase: 'error' });
          return;
        }
        try {
          const query = new URLSearchParams({
            t: token,
            lang: this.language(),
            tz: String(-new Date().getTimezoneOffset() * 60),
          });
          const response = await fetch('/api-credits/balance?' + query.toString(), { cache: 'no-store' });
          if (!response.ok) {
            this.note('route: HTTP ' + response.status);
            this.emit({ balancePhase: 'error' });
            return;
          }
          const payload = await response.json();
          if (!payload || payload.ok !== true) {
            this.note('route: ' + (payload && payload.reason ? payload.reason : 'failed'));
            this.emit({ balancePhase: 'error' });
            return;
          }
          if (payload.signedIn !== true) {
            this.emit({ wallets: [], balancePhase: 'signed-out', balanceSource: 'route', balanceDiag: '' });
            return;
          }
          const details = payload.balance;
          if (!details || details.status !== 'ready') {
            this.note('route: balance ' + (details && details.status));
            this.emit({ balancePhase: 'error' });
            return;
          }
          this.applyWallets(details.value, 'route');
        } catch (error) {
          this.note('route: ' + describeError(error));
          this.emit({ balancePhase: 'error' });
        }
      }

      dispose() {
        for (const timer of this.timers) clearInterval(timer);
        this.timers.clear();
        if (typeof window !== 'undefined') {
          window.removeEventListener('focus', this.onWindowFocus);
          if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.onVisibility);
          }
        }
        this.listeners.clear();
      }
    }
    //#endregion

    //#region components
    const useSyncExternalStore = React.useSyncExternalStore
      ? React.useSyncExternalStore
      : (subscribe, getSnapshot) => {
          const [value, setValue] = React.useState(getSnapshot);
          React.useEffect(() => subscribe(() => setValue(getSnapshot())), [subscribe, getSnapshot]);
          return value;
        };

    function useCredits(store) {
      return useSyncExternalStore(store.subscribe, store.getSnapshot);
    }

    function CreditIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': 'true' },
        h('circle', { cx: 8, cy: 8, r: 6.1 }),
        h('path', { d: 'M5.7 5.3 8 8.1l2.3-2.8M8 8.1v3.5M6.4 9.5h3.2M6.4 11h3.2', strokeLinecap: 'round' }),
      );
    }

    function pillLabel(totals, localeTag) {
      if (totals.cny === null) {
        return walletsText(totals.wallets, localeTag);
      }
      const parts = [];
      if (totals.usd !== null) parts.push(formatMoney(totals.usd, 'USD', localeTag));
      if (totals.local !== null) parts.push(formatMoney(totals.local, totals.localCode, localeTag));
      const tail = parts.length > 0 ? ' (' + parts.join(', ') + ')' : '';
      return formatMoney(totals.cny, 'CNY', localeTag) + tail;
    }

    /** `¥1 = 12.18 ₽ · $1 = 6.70 ¥` in the configured local currency. */
    function rateLine(totals, localeTag) {
      const parts = [];
      if (totals.localRate !== null) {
        parts.push('¥1 = ' + groupNumber(totals.localRate, 2, localeTag) + ' ' + currencySymbol(totals.localCode, localeTag));
      }
      if (totals.rate && totals.rate.usdPerCny > 0) {
        parts.push('$1 = ' + groupNumber(1 / totals.rate.usdPerCny, 2, localeTag) + ' ¥');
      }
      return parts.join(' · ');
    }

    function Tooltip({ open, anchorRef, children }) {
      const [position, setPosition] = React.useState(null);
      const canPortal = !!(ReactDOM && ReactDOM.createPortal && typeof document !== 'undefined');

      React.useEffect(() => {
        if (!open || !canPortal) {
          setPosition(null);
          return;
        }
        const rect = anchorRef.current && anchorRef.current.getBoundingClientRect();
        if (!rect) return;
        setPosition({ left: rect.left, top: rect.top });
      }, [open, anchorRef, canPortal]);

      if (!open) return null;
      // Without a portal the panel stays inside the pill's own box: anchoring it
      // absolutely keeps it attached even when an ancestor transforms the layout.
      if (!canPortal) return h('div', { className: 'dshac-tip dshac-tipInline', role: 'tooltip' }, children);
      if (!position) return null;
      const width = 360;
      const left = Math.max(8, Math.min(position.left, (window.innerWidth || width) - width - 8));
      const style = {
        position: 'fixed',
        left: left,
        bottom: Math.max(8, (window.innerHeight || 0) - position.top + 8),
        zIndex: 1200,
      };
      return ReactDOM.createPortal(h('div', { className: 'dshac-tip', style, role: 'tooltip' }, children), document.body);
    }

    function TipRow({ label, value }) {
      return h(
        'div',
        { className: 'dshac-tipRow' },
        h('span', { className: 'dshac-tipKey' }, label),
        h('span', { className: 'dshac-tipVal' }, value),
      );
    }

    function ProviderNote({ state, t, localeTag, language }) {
      const failed = PROVIDERS.filter(
        (provider) => state.providerStatus[provider.id] === 'failed' || state.providerStatus[provider.id] === 'timeout',
      );
      if (failed.length === 0) return null;
      return h(
        'div',
        { className: 'dshac-tipNote' },
        t('unavailableProviders') + ' ' + failed.map((provider) => providerLabel(provider.id, language)).join(', '),
      );
    }

    function CreditsPill({ credits, t }) {
      const state = useCredits(credits);
      const [open, setOpen] = React.useState(false);
      const anchorRef = React.useRef(null);
      const totals = derive(state);
      const language = credits.language();
      const localeTag = credits.localeTag();

      if (!totals) return null;

      const label = pillLabel(totals, localeTag);
      const summary =
        t('toppedUp') + ': ' + walletsText(totals.wallets, localeTag) + (totals.local !== null ? ' (' + formatMoney(totals.local, totals.localCode, localeTag) + ')' : '');

      return h(
        'span',
        {
          className: 'dshac-anchor',
          ref: anchorRef,
          tabIndex: 0,
          role: 'note',
          'aria-label': t('pillAria') + '. ' + summary,
          onMouseEnter: () => setOpen(true),
          onMouseLeave: () => setOpen(false),
          onFocus: () => setOpen(true),
          onBlur: () => setOpen(false),
        },
        h(
          'span',
          { className: 'dshac-pill', 'data-composer-stat': 'api-credits' },
          h(CreditIcon),
          h('span', { className: 'dshac-label' }, label),
        ),
        h(
          Tooltip,
          { open, anchorRef },
          h('div', { className: 'dshac-tipTitle' }, t('nav')),
          h(TipRow, { label: t('toppedUp'), value: walletsText(totals.wallets, localeTag) }),
          totals.local !== null && h(TipRow, { label: t('approx'), value: formatMoney(totals.local, totals.localCode, localeTag) }),
          h('div', { className: 'dshac-tipRule' }),
          totals.rate
            ? h(TipRow, {
                label: t('rateSource'),
                value:
                  providerLabel(totals.rate.provider, language) +
                  (state.ratePhase === 'cached' || state.ratePhase === 'stale' ? ' · ' + t('fromCache') : ''),
              })
            : null,
          totals.rate
            ? h(TipRow, {
                label: '¥1',
                value: rateLine(totals, localeTag),
              })
            : null,
          totals.rate ? h(TipRow, { label: t('updated'), value: formatTime(totals.rate.at, localeTag) }) : null,
          !totals.rate ? h('div', { className: 'dshac-tipNote' }, t('rateUnavailable')) : null,
          !totals.rate && state.ratePhase === 'failed' ? h('div', { className: 'dshac-tipNote' }, t('failed')) : null,
          h(ProviderNote, { state, t, localeTag, language }),
        ),
      );
    }

    /** A receipt glyph: this pill is spend, not the wallet. */
    function SpendIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, 'aria-hidden': 'true' },
        h('path', { d: 'M4.6 2.4h6.8v11.2l-1.7-1-1.7 1-1.7-1-1.7 1z', strokeLinejoin: 'round' }),
        h('path', { d: 'M6.4 5.6h3.2M6.4 8h3.2', strokeLinecap: 'round' }),
      );
    }

    /**
     * Session spend: the whole-log token usage folded through the billing
     * buckets, so cache hits are priced at the hit rate instead of the miss rate.
     *
     * With `treeScope: 'tree'` the pill adds every subagent's spend, read from
     * the Host aggregate (`/api-credits/spend`): a subagent is a separate
     * Session, so this Session's `tokenUsage` cannot see it. When the aggregate
     * is unavailable the pill silently keeps the own-session figure, which is
     * exactly the previous behaviour.
     */
    function SpendPill({ credits, t, useProjection, sessionId, useSession }) {
      const state = useCredits(credits);
      const [open, setOpen] = React.useState(false);
      const anchorRef = React.useRef(null);
      const usage = typeof useProjection === 'function' ? useProjection('tokenUsage') : undefined;
      const catalog = typeof useProjection === 'function' ? useProjection('subagentCatalog') : undefined;
      const sessionRunning = typeof useSession === 'function' ? useSession((snapshot) => !!(snapshot && snapshot.running)) : undefined;
      const localeTag = credits.localeTag();

      const includeTree = state.treeScope !== 'self';
      const tree = includeTree && sessionId ? state.spend[sessionId] : undefined;
      const catalogLength = Array.isArray(catalog) ? catalog.length : 0;

      // A new child shows up in the live catalog projection; a finished turn
      // means children likely settled. Both are cheaper and more exact than a
      // permanent timer.
      React.useEffect(() => {
        if (!includeTree || !sessionId) return;
        credits.refreshSpend(sessionId, false);
      }, [includeTree, sessionId, catalogLength]);

      React.useEffect(() => {
        if (!includeTree || !sessionId || sessionRunning !== false) return;
        credits.refreshSpend(sessionId, true);
      }, [includeTree, sessionId, sessionRunning]);

      const anyRunning = !!(tree && tree.payload && tree.payload.anyRunning);
      React.useEffect(() => {
        if (!includeTree || !sessionId || !anyRunning) return;
        const timer = setInterval(() => credits.refreshSpend(sessionId, true), SPEND_POLL_MS);
        return () => clearInterval(timer);
      }, [includeTree, sessionId, anyRunning]);

      const ownBuckets = usage
        ? sessionBuckets(usage, Date.now())
        : tree
          ? sessionBuckets(tree.payload.own, Date.now())
          : null;
      if (!ownBuckets) return null;

      const payload = tree && tree.payload && Array.isArray(tree.payload.agents) ? tree.payload : null;
      const hasTree = !!(payload && payload.agents.length > 0);
      const totalsBuckets = hasTree ? sessionBuckets(payload.totals, Date.now()) : ownBuckets;
      // Inside one tree reply the parts must add up to the total, so the own part
      // comes from the same snapshot as the totals, not from the live projection.
      const ownPartBuckets = hasTree ? sessionBuckets(payload.own, Date.now()) : ownBuckets;
      const billed = totalsBuckets.fresh + totalsBuckets.write + totalsBuckets.hit + totalsBuckets.out;
      if (billed === 0) return null;

      const family = PRICES[ownBuckets.family];
      const factor = totalsBuckets.peak ? 2 : 1;
      const localCode = state.localCurrency || DEFAULT_LOCAL_CURRENCY;
      const rawLocal = state.rate && state.rate.rates ? state.rate.rates[localCode] : undefined;
      const localRate = Number.isFinite(rawLocal) && rawLocal > 0 ? rawLocal : null;

      let currency;
      let table;
      let convert = 1;
      if (state.spendMode === 'local' && localRate !== null) {
        currency = localCode;
        table = family.CNY;
        convert = localRate;
      } else {
        currency = state.spendMode === 'local' ? 'CNY' : topUpCurrency(state);
        table = family[currency === 'USD' ? 'USD' : 'CNY'];
      }

      const money = (buckets) => spendValue(buckets, table, factor) * convert;
      const cost = formatCost(money(totalsBuckets), currency, localeTag);
      const ownCost = money(ownPartBuckets);
      const cnyValue = spendValue(totalsBuckets, family.CNY, factor);
      const unit = (price) => formatMoney(price * factor * convert, currency, localeTag) + '/1M';

      const agentUsage = hasTree ? foldAgentUsage(payload.agents) : null;
      const agentBuckets = agentUsage ? sessionBuckets(agentUsage, Date.now()) : null;
      const agentCost = agentBuckets ? money(agentBuckets) : 0;
      const agentRows = hasTree
        ? payload.agents
            .map((agent) => ({ agent, value: money(sessionBuckets(agent.usage || {}, Date.now())) }))
            .sort((left, right) => right.value - left.value)
        : [];
      const shownRows = agentRows.slice(0, 5);
      const restCost = Math.max(0, agentCost - shownRows.reduce((sum, row) => sum + row.value, 0));

      const tip = [];
      tip.push(h('div', { className: 'dshac-tipTitle', key: 'title' }, t('sessionSpend')));
      tip.push(h(TipRow, { key: 'new', label: t('tokensNew'), value: compactTokens(totalsBuckets.fresh) + ' × ' + unit(table.miss) }));
      if (totalsBuckets.write > 0) {
        tip.push(h(TipRow, { key: 'write', label: t('tokensWrite'), value: compactTokens(totalsBuckets.write) + ' × ' + unit(table.miss) }));
      }
      tip.push(h(TipRow, { key: 'hit', label: t('tokensHit'), value: compactTokens(totalsBuckets.hit) + ' × ' + unit(table.hit) }));
      tip.push(h(TipRow, { key: 'out', label: t('tokensOut'), value: compactTokens(totalsBuckets.out) + ' × ' + unit(table.output) }));
      tip.push(h('div', { className: 'dshac-tipRule', key: 'rule-total' }));
      tip.push(h(TipRow, { key: 'total', label: t('total'), value: cost }));

      if (hasTree) {
        tip.push(h('div', { className: 'dshac-tipRule', key: 'rule-parts' }));
        tip.push(h(TipRow, { key: 'own', label: t('sessionSubtotal'), value: formatCost(ownCost, currency, localeTag) }));
        tip.push(
          h(TipRow, {
            key: 'agents',
            label: t('subagents') + ' · ' + payload.agents.length,
            value: formatCost(agentCost, currency, localeTag),
          }),
        );
        for (const row of shownRows) {
          tip.push(h(TipRow, { key: 'agent:' + row.agent.id, label: agentLabel(row.agent), value: formatCost(row.value, currency, localeTag) }));
        }
        if (agentRows.length > shownRows.length) {
          tip.push(
            h(TipRow, {
              key: 'agents-rest',
              label: t('otherAgents') + ' · ' + (agentRows.length - shownRows.length),
              value: formatCost(restCost, currency, localeTag),
            }),
          );
        }
      }

      if (currency !== 'CNY') {
        tip.push(h(TipRow, { key: 'cny', label: t('inCny'), value: formatCost(cnyValue, 'CNY', localeTag) }));
      }
      if (state.spendMode === 'local' && localRate === null) {
        tip.push(h('div', { className: 'dshac-tipNote', key: 'norate' }, t('rateUnavailable')));
      }
      if (hasTree && payload.externals.length > 0) {
        tip.push(h('div', { className: 'dshac-tipNote', key: 'external' }, t('externalUnmeasured') + ' · ' + payload.externals.length));
      }
      if (hasTree && payload.missing.length > 0) {
        tip.push(h('div', { className: 'dshac-tipNote', key: 'missing' }, t('childLogsMissing') + ' · ' + payload.missing.length));
      }
      if (hasTree && payload.truncated) {
        tip.push(h('div', { className: 'dshac-tipNote', key: 'truncated' }, t('treeTruncated')));
      }
      tip.push(
        h(
          'div',
          { className: 'dshac-tipNote', key: 'tariff' },
          t('tariff') + ' ' + family.id + ' · ' + (totalsBuckets.peak ? t('peak') : t('offPeak')),
        ),
      );

      return h(
        'span',
        {
          className: 'dshac-anchor',
          ref: anchorRef,
          tabIndex: 0,
          role: 'note',
          'aria-label': (hasTree ? t('spendWithSubagents') : t('spendAria')) + ': ' + cost,
          onMouseEnter: () => setOpen(true),
          onMouseLeave: () => setOpen(false),
          onFocus: () => setOpen(true),
          onBlur: () => setOpen(false),
        },
        h(
          'span',
          { className: 'dshac-pill', 'data-composer-stat': 'api-credits-spend' },
          h(SpendIcon),
          h('span', { className: 'dshac-label' }, '−' + cost),
          hasTree && h('span', { className: 'dshac-sub', 'aria-hidden': 'true' }, '+' + payload.agents.length),
        ),
        h(Tooltip, { open, anchorRef }, tip),
      );
    }

    /** Source wallets rendered the way the shipped account card renders them: `¥Y + $X`. */
    function WalletAmount({ totals, localeTag }) {
      const parts = [];
      for (const wallet of totals.wallets) {
        const text = formatMoney(Number(wallet.balance), wallet.currency, localeTag);
        if (!text) continue;
        parts.push(h('span', { key: wallet.currency }, text));
      }
      if (parts.length === 0) return null;
      return h('span', { className: 'dshac-amount' }, parts);
    }

    function CreditsSection({ credits, t }) {
      const state = useCredits(credits);
      const totals = derive(state);
      const language = credits.language();
      const localeTag = credits.localeTag();
      const rate = state.rate;
      const localCode = state.localCurrency || DEFAULT_LOCAL_CURRENCY;
      const localRate =
        rate && rate.rates && Number.isFinite(rate.rates[localCode]) && rate.rates[localCode] > 0 ? rate.rates[localCode] : null;

      const children = [];

      if (state.balancePhase === 'signed-out') {
        children.push(h('div', { className: 'dshac-row', key: 'signin' }, h('span', { className: 'dshac-muted' }, t('signIn'))));
      } else if (state.balancePhase === 'error') {
        children.push(h('div', { className: 'dshac-row', key: 'unavailable' }, h('span', { className: 'dshac-muted' }, t('unavailable'))));
      } else if (!totals) {
        children.push(
          h(
            'div',
            { className: 'dshac-row', key: 'loading' },
            h('span', { className: 'dshac-muted' }, state.balancePhase === 'empty' ? t('unavailable') : t('loading')),
          ),
        );
      } else {
        children.push(
          h(
            'div',
            { className: 'dshac-row', key: 'balance' },
            h('span', {}, t('toppedUp')),
            h(WalletAmount, { totals, localeTag }),
          ),
        );
        if (totals.local !== null) {
          children.push(
            h(
              'div',
              { className: 'dshac-row dshac-rowTight', key: 'rub' },
              h('span', {}),
              h('span', { className: 'dshac-rub' }, '≈ ' + formatMoney(totals.local, totals.localCode, localeTag)),
            ),
          );
        } else {
          children.push(
            h(
              'div',
              { className: 'dshac-row dshac-rowTight', key: 'balance-norate' },
              h('span', {}),
              h('span', { className: 'dshac-muted' }, t('rateUnavailable')),
            ),
          );
        }
      }

      if (state.balanceDiag) {
        children.push(h('div', { className: 'dshac-diag', key: 'diag' }, state.balanceDiag));
      }
      if (state.spendDiag) {
        children.push(h('div', { className: 'dshac-diag', key: 'spend-diag' }, state.spendDiag));
      }

      children.push(
        h(
          'div',
          { className: 'dshac-row', key: 'local-currency' },
          h('span', {}, t('localCurrency')),
          h(
            'select',
            {
              className: 'dshac-select',
              value: localCode,
              'aria-label': t('localCurrency'),
              onChange: (event) => credits.setLocalCurrency(event.target.value),
            },
            LOCAL_CURRENCIES.map((code) =>
              h('option', { key: code, value: code }, code + ' · ' + currencyName(code, language)),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dshac-row', key: 'spend-mode' },
          h('span', {}, t('spendIn')),
          h(
            'span',
            { className: 'dshac-segment', role: 'group', 'aria-label': t('spendIn') },
            h(
              'button',
              {
                type: 'button',
                'aria-pressed': state.spendMode === 'local' ? 'true' : 'false',
                onClick: () => credits.setSpendMode('local'),
              },
              t('spendLocal') + ' (' + currencySymbol(localCode, localeTag) + ')',
            ),
            h(
              'button',
              {
                type: 'button',
                'aria-pressed': state.spendMode === 'local' ? 'false' : 'true',
                onClick: () => credits.setSpendMode('topup'),
              },
              t('spendTopUp') + ' (' + currencySymbol(topUpCurrency(state), localeTag) + ')',
            ),
          ),
        ),
        h(
          'div',
          { className: 'dshac-row', key: 'tree-scope' },
          h('span', {}, t('subagents')),
          h(
            'span',
            { className: 'dshac-segment', role: 'group', 'aria-label': t('treeScopeAria') },
            h(
              'button',
              {
                type: 'button',
                'aria-pressed': state.treeScope === 'tree' ? 'true' : 'false',
                onClick: () => credits.setTreeScope('tree'),
              },
              t('includeSubagents'),
            ),
            h(
              'button',
              {
                type: 'button',
                'aria-pressed': state.treeScope === 'self' ? 'true' : 'false',
                onClick: () => credits.setTreeScope('self'),
              },
              t('onlyThisSession'),
            ),
          ),
        ),
      );

      children.push(h('div', { className: 'dshac-divider', key: 'rule' }));

      if (rate) {
        children.push(
          h(
            'div',
            { className: 'dshac-row', key: 'source' },
            h('span', {}, t('rateSource')),
            h(
              'span',
              { className: 'dshac-source' },
              providerLabel(rate.provider, language) + ' · ' + (PROVIDER_BY_ID.get(rate.provider) || {}).host,
            ),
          ),
          h(
            'div',
            { className: 'dshac-row', key: 'rate' },
            h('span', {}, '¥1'),
            h('span', {}, rateLine({ rate, localRate, localCode }, localeTag)),
          ),
          h(
            'div',
            { className: 'dshac-row', key: 'updated' },
            h('span', {}, t('updated')),
            h(
              'span',
              { className: 'dshac-muted' },
              formatTime(rate.at, localeTag) +
                ' · ' +
                formatAge(rate.at) +
                (state.ratePhase === 'cached' || state.ratePhase === 'stale' ? ' · ' + t('fromCache') : ''),
            ),
          ),
        );
      } else {
        children.push(
          h(
            'div',
            { className: 'dshac-row', key: 'norate' },
            h('span', { className: 'dshac-muted' }, state.ratePhase === 'failed' ? t('failed') : t('loading')),
          ),
        );
      }

      if (rate) {
        children.push(h(ProviderNote, { state, t, localeTag, language, key: 'providers' }));
      }

      children.push(
        h(
          'div',
          { className: 'dshac-actions', key: 'actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dshac-button',
              onClick: () => credits.refreshAll(),
            },
            t('refresh'),
          ),
        ),
      );

      return h('div', { className: 'dshac-page' }, h('div', { className: 'dshac-card' }, children));
    }
    //#endregion

    //#region styles
    const STYLE = `
.dshac-anchor{position:relative;display:inline-flex;min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px))}
.dshac-pill{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:1px 8px;border:none;border-radius:var(--dsw-radius-sm,6px);background:0 0;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;cursor:default}
.dshac-pill svg{flex:none;width:14px;height:14px}
.dshac-anchor:hover .dshac-pill,.dshac-anchor:focus-visible .dshac-pill{background:var(--dsw-alias-interactive-bg-hover,transparent);color:var(--dsw-alias-label-secondary)}
.dshac-anchor:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px;border-radius:var(--dsw-radius-sm,6px)}
.dshac-label{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dshac-sub{margin-left:2px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-variant-numeric:tabular-nums}
.dshac-tip{box-sizing:border-box;width:max-content;min-width:260px;max-width:min(360px,calc(100vw - 16px));padding:10px 12px;border:.5px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-lg,10px);background-color:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#1b1b1d)));box-shadow:var(--dsw-elevation-prominent,0 10px 28px rgba(0,0,0,.32));color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;cursor:default}
.dshac-tipInline{position:absolute;left:0;bottom:calc(100% + 8px);z-index:30}
.dshac-tipTitle{margin-bottom:6px;color:var(--dsw-alias-label-primary);font-weight:500}
.dshac-tipRow{display:flex;justify-content:space-between;gap:16px;padding:2px 0}
.dshac-tipKey{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.dshac-tipVal{font-variant-numeric:tabular-nums;text-align:right;overflow-wrap:anywhere}
.dshac-tipRule{border-top:.5px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1));margin:6px 0}
.dshac-tipNote{margin-top:6px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;line-height:16px}
.dshac-page{display:flex;flex-direction:column;gap:16px;padding:8px 0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:22px}
.dshac-card{display:flex;flex-direction:column;gap:8px;padding:12px 16px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-xl,14px);background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-1))}
.dshac-row{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:40px;padding:6px 0}
.dshac-rowTight{min-height:0;padding:0}
.dshac-amount{display:flex;flex-wrap:wrap;justify-content:flex-end;font-size:18px;font-weight:510;line-height:28px;font-variant-numeric:tabular-nums}
.dshac-amount>span+span::before{content:" + ";white-space:pre}
.dshac-rub{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-variant-numeric:tabular-nums}
.dshac-muted{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.dshac-source{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dshac-diag{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-tertiary));font-size:11px;line-height:16px;overflow-wrap:anywhere;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace)}
.dshac-divider{border-top:.5px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1))}
.dshac-actions{display:flex;justify-content:flex-end}
.dshac-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:58px;height:36px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,8px);background:0 0;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px;white-space:nowrap;cursor:pointer}
.dshac-select{box-sizing:border-box;height:36px;max-width:240px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,8px);background-color:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.dshac-select:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.dshac-segment{display:inline-flex;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));border-radius:var(--dsw-radius-md,8px);overflow:hidden}
.dshac-segment button{height:34px;padding:0 12px;border:0;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;white-space:nowrap;cursor:pointer}
.dshac-segment button+button{border-left:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2))}
.dshac-segment button:hover{background:var(--dsw-alias-interactive-bg-hover,transparent)}
.dshac-segment button[aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-hover,transparent);color:var(--dsw-alias-label-primary);font-weight:500}
.dshac-segment button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.dshac-button:hover{background:var(--dsw-alias-interactive-bg-hover,transparent)}
.dshac-button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
`;
    //#endregion

    function registerLocale(ctx) {
      const disposers = [];
      for (const [locale, dict] of Object.entries(DICTS)) {
        try {
          disposers.push(ctx.locale.register(NS, locale, dict));
        } catch (error) {
          /* this build has no dictionary for that language */
        }
      }
      return () => {
        for (const dispose of disposers) dispose();
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const store = new CreditStore(ctx);
        const t = ctx.locale.bind(NS);

        ctx.effect(() => registerLocale(ctx));

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-usage-credits';
          tag.textContent = STYLE;
          document.head.appendChild(tag);
          return () => tag.remove();
        });

        ctx.effect(() => {
          store.start();
          return () => store.dispose();
        });

        ctx.slots.inject('conversation.composer.dock', () => {
          const balance = ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'api-credits',
              order: 2,
              locale: NS,
              inject: () => ({ credits: store }),
            },
            CreditsPill,
          );
          const spend = ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'api-credits-spend',
              order: 3,
              locale: NS,
              inject: () => ({ credits: store }),
            },
            SpendPill,
          );
          return () => {
            spend();
            balance();
          };
        });

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'api-credits',
              order: -9,
              label: () => t('nav'),
              locale: NS,
              inject: () => ({ credits: store }),
            },
            CreditsSection,
          ),
        );
      },
    };
  },
});

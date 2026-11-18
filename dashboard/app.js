// Token Radar's dashboard, model radar-2. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail drawer with the
// model's full breakdown and the protocol's farm plan. No network: every byte it shows is in data.js.
// The farm plan and the implied value below are the same derivation main.ts writes to board.json:
// category, chains, TVL and age decide the action, the capital, the hold and every cost and time.
// No protocol name is special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlistOnly: false, tvlMin: 0, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return (Math.round(n * 10000) / 10000).toFixed(2).replace(/0$/, ''); }

  // The model in one place, identical to lib/model.ts: category multiple, growth, the age curve
  // and chain diversity. The page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function categoryMultiple(category) {
    var c = (category || '').toLowerCase();
    if (c === 'dexs') return 0.35;
    if (c === 'lending' || c === 'yield' || c === 'yield aggregator' || c === 'derivatives' || c === 'liquidity manager' || c === 'uncollateralized lending') return 0.3;
    if (c === 'cdp' || c === 'cdp manager' || c === 'basis trading' || c === 'interest rate derivatives' || c === 'leveraged farming') return 0.28;
    if (c === 'risk curators' || c === 'onchain capital allocator' || c === 'collateral markets' || c === 'prediction market' || c === 'farm') return 0.25;
    if (c === 'rwa' || c === 'indexes') return 0.22;
    if (c === 'chain' || c === 'payments' || c === 'governance incentives' || c === 'cedefi' || c === 'otc marketplace') return 0.2;
    if (c === 'dual-token stablecoin') return 0.18;
    if (c === 'bridge' || c === 'canonical bridge' || c === 'cross chain bridge' || c === 'anchor btc' || c === 'decentralized btc' || c === 'staking pool' || c === 'crypto card issuer') return 0.15;
    if (c === 'liquid staking' || c === 'liquid restaking' || c === 'restaking' || c === 'restaked btc') return 0.12;
    if (c === 'stablecoin wrapper') return 0.1;
    if (c === 'insurance') return 0.2;
    return DATA.model.default_multiple;
  }
  function maturityMultiplier(age) {
    if (age === null || age === undefined) return DATA.model.unknown_age_multiplier;
    if (age < 90) return 0.7 + (age / 90) * 0.1;
    if (age < 365) return 0.8 + ((age - 90) / 275) * 0.2;
    if (age < 1095) return 1.0 + ((age - 365) / 730) * 0.1;
    return 1.1 - Math.min((age - 1095) / 730, 1) * 0.15;
  }
  function chainMultiplier(n) {
    if (n >= 10) return DATA.model.chain_mult_10;
    if (n >= 4) return DATA.model.chain_mult_4_9;
    if (n >= 2) return DATA.model.chain_mult_2_3;
    return DATA.model.chain_mult_1;
  }
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    return Math.max(1, Math.round(row.tvl_usd * categoryMultiple(row.category) * growthMult * maturityMultiplier(row.age_days) * chainMultiplier((row.chains || []).length)));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasFor(chain) {
    if (chain === 'Ethereum') return 'about $8 of gas';
    if (chain === 'Bitcoin' || chain === 'Tron') return 'about $3 of gas';
    return 'under $1 of gas';
  }
  function groupOf(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'lending';
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return 'dex';
    if (c.indexOf('bridge') >= 0) return 'bridge';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'staking';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0) return 'perps';
    if (c.indexOf('prediction') >= 0) return 'prediction';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'curator';
    if (c.indexOf('stable') >= 0) return 'stable';
    if (c.indexOf('rwa') >= 0) return 'rwa';
    if (c.indexOf('insurance') >= 0) return 'insurance';
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'yield';
    return 'default';
  }
  function coreAction(g, p, capital, chain) {
    var name = p.name;
    if (g === 'lending') return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' as collateral, at the pool with the deepest liquidity.';
    if (g === 'dex') return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ', in the pair with the most volume.';
    if (g === 'bridge') return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds inside its own app.';
    if (g === 'staking') return 'Stake $' + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token.';
    if (g === 'perps') return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' on ' + chain + ' and open one small hedged position.';
    if (g === 'prediction') return 'Fund $' + capital + ' on ' + name + ' and place one position on a market that closes after the next snapshot.';
    if (g === 'curator') return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares in the farm wallet.';
    if (g === 'stable') return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold the receipt.';
    if (g === 'rwa') return 'Mint $' + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it in the farm wallet.';
    if (g === 'insurance') return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active for the full term.';
    if (g === 'yield') return 'Deposit $' + capital + ' into ' + name + "'s highest-TVL strategy on " + chain + ' and leave the yield compounding.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondAction(g, p, capital, chain) {
    var name = p.name;
    var small = Math.max(10, Math.round(capital / 5));
    if (g === 'lending') return 'Borrow $' + small + ' against the supply on ' + name + ', use it once, then repay it in full the same week.';
    if (g === 'dex') return 'Swap $' + small + ' through ' + name + "'s pool on " + chain + ' in the opposite direction, so the wallet both supplies and trades.';
    if (g === 'bridge') return 'Bridge $' + small + ' back through ' + name + ' to the chain you started from, so the wallet is a round-trip user.';
    if (g === 'staking') return 'Claim the staking rewards ' + name + ' pays on ' + chain + ' once, then restake them instead of selling.';
    if (g === 'perps') return 'Close the hedge on ' + name + ' and open a fresh one half the size, so the wallet shows two distinct trades.';
    if (g === 'prediction') return 'Settle or close the first position on ' + name + ', then place a second one on a different market.';
    if (g === 'curator') return 'Deposit $' + small + ' more into a second ' + name + ' vault on ' + chain + ', so the wallet holds two vaults.';
    if (g === 'stable') return 'Redeem $' + small + ' of the stable asset back through ' + name + ' on ' + chain + ', then re-deposit it the next day.';
    if (g === 'rwa') return 'Claim the yield ' + name + "'s asset paid on " + chain + ' once and hold the proceeds in the same wallet.';
    if (g === 'insurance') return 'File a test claim check on ' + name + ' (read the policy terms, do not file a false claim) and renew the cover.';
    if (g === 'yield') return 'Harvest the yield ' + name + ' paid on ' + chain + ' once and compound it back into the same strategy.';
    return 'Make a second, different interaction with ' + name + ' on ' + chain + ' for $' + small + ', such as a swap or a vote.';
  }
  function weeklyAction(g, p) {
    var name = p.name;
    if (g === 'lending') return 'Top up the supply or adjust the borrow on ' + name + ' by a small amount each week.';
    if (g === 'dex') return 'Swap a small amount through ' + name + ' each week, keeping the liquidity position untouched.';
    if (g === 'bridge') return 'Bridge a small amount through ' + name + ' each week, alternating direction when the app allows it.';
    if (g === 'staking') return 'Check the staking rewards on ' + name + ' each week and restake whatever has accrued.';
    if (g === 'perps') return 'Rebalance the hedge on ' + name + ' once a week, keeping the margin above the liquidation level.';
    if (g === 'prediction') return 'Place one new market position on ' + name + ' each week, on a market that is still open.';
    if (g === 'curator') return 'Check the vault allocation on ' + name + ' each week and move a small amount to the best-performing vault.';
    if (g === 'stable') return 'Mint or redeem a small amount through ' + name + ' each week, keeping the receipt in the farm wallet.';
    if (g === 'rwa') return 'Check the yield ' + name + "'s asset paid each week and leave it compounding in the same wallet.";
    if (g === 'insurance') return 'Check the cover on ' + name + ' each week and renew it before it lapses.';
    if (g === 'yield') return 'Harvest and compound the yield on ' + name + ' once a week.';
    return 'Make one qualifying action on ' + name + ' each week, such as a deposit, a swap or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    var g = groupOf(p);
    var weeklyGas = chain === 'Ethereum' ? 'about $8 of gas a week' : chain === 'Bitcoin' || chain === 'Tron' ? 'about $3 of gas a week' : 'under $1 of gas a week';
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, keep its seed phrase offline, and open ' + p.name + ' only from the link its own site publishes, never from a search ad.', cost: gas + ' for the first transaction', time: '5 minutes' },
      { text: coreAction(g, p, capital, chain), cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
      { text: secondAction(g, p, capital, chain), cost: 'about $' + Math.max(10, Math.round(capital / 5)) + ' of capital and ' + gas, time: '10 minutes' },
      { text: weeklyAction(g, p), cost: weeklyGas, time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot, and never withdraw and re-deposit in a single day.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Open " + p.name + "'s own points or rewards page and check whether the wallet earned anything, claiming only from the link that page publishes and never paying a fee to claim.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, then unwind in tranches after the snapshot, checking for lockups or withdrawal delays first.', cost: 'nothing but the log', time: '5 minutes to log, a day to unwind' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist') === '1') state.watchlistOnly = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('watchlist', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.watchlistOnly && !r.watchlist) return false;
      if (r.tvl_usd < state.tvlMin) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. This board ranks all ' + DATA.board_size + ' pre-token protocols that can be ranked, watchlist and early alike, by one stated model. Implied value is a model, not a promise, and "no token" means the snapshot records none.' }),
        el('p', { class: 'sub', text: top ? 'Top of the board: ' + top.name + ' at ' + fmtUsd(top.implied_value_usd) + ' implied value on ' + fmtUsd(top.tvl_usd) + ' of TVL.' : '' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function spotlight() {
    var cards = DATA.rows.slice(0, 3).map(function (r) {
      return el('button', { type: 'button', class: 'spot', onclick: function () { openDetail(r.slug); } },
        el('span', { class: 'spot-rank', text: '#' + r.rank }),
        el('b', { text: r.name }),
        el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + fmtUsd(r.tvl_usd) + ' TVL · ' + fmtPct(r.change_7d) + ' in 7d' }),
        el('span', { class: 'num spot-value', text: fmtUsd(r.implied_value_usd) + ' implied' })
      );
    });
    return el('section', { class: 'spots', 'aria-label': 'Top three protocols' }, cards);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var tvlSelect = el('select', { id: 'tvl', 'aria-label': 'Minimum TVL' },
      [0, 5e6, 5e7, 1e8, 5e8, 1e9].map(function (v) { return el('option', { value: String(v), text: v === 0 ? 'Any TVL' : 'TVL at least ' + fmtUsd(v), selected: v === state.tvlMin ? 'selected' : null }); })
    );
    tvlSelect.addEventListener('change', function () { state.tvlMin = Number(tvlSelect.value); render(); });
    var wl = el('button', { type: 'button', class: 'toggle', 'aria-pressed': state.watchlistOnly ? 'true' : 'false', text: state.watchlistOnly ? 'Watchlist only: on' : 'Watchlist only', onclick: function () { state.watchlistOnly = !state.watchlistOnly; writeHash(); render(); } });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'tvl', text: 'TVL' }), tvlSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Scope' }), wl),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; state.tvlMin = 0; writeHash(); render(); } })
      ));
    }
    var max = DATA.rows[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.chains && r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: r.watchlist ? 'watchlist · no token' : 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var cats = [['Dexs', '0.35'], ['Lending, Yield, Derivatives', '0.30'], ['CDP, Basis Trading', '0.28'], ['Risk Curators, Capital Allocators', '0.25'], ['RWA', '0.22'], ['Chain, Payments', '0.20'], ['Bridge', '0.15'], ['Liquid Staking, Liquid Restaking', '0.12'], ['Stablecoin Wrapper', '0.10'], ['Other categories', '0.25']];
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x category_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x maturity(age_days) x chain_mult(chains) )'
      ),
      el('p', { class: 'sub', text: 'Maturity is an age curve, not a straight line: under 90 days 0.70-0.80, 90-365 days 0.80-1.00, 1-3 years with no token 1.00-1.10, past 3 years it eases back to 0.95; an unknown age uses 0.85. Chain diversity is 1.00 on one chain, 1.05 on 2-3, 1.10 on 4-9 and 1.12 on 10 or more.' }),
      el('div', { class: 'cat-table' }, cats.map(function (c) {
        return el('div', { class: 'cat-row' }, el('span', { text: c[0] }), el('b', { class: 'num', text: c[1] }));
      })),
      el('p', { class: 'sub', text: 'The category multiple is a sector assumption applied by category alone: a standalone exchange or lender earns more per TVL dollar than a wrapped or staked product, whose value already lives in the token it wraps. The early radar is every rankable pre-token protocol below the watchlist floor, and the live-token protocols are set aside with their market caps shown.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    var why = row.name + ' ranks #' + row.rank + ' because ' + fmtUsd(row.tvl_usd) + ' of TVL at a ' + fmtMult(row.category_multiplier) + 'x sector multiple, ' + fmtPct(row.change_7d) + ' over seven days and ' + fmtAge(row.age_days) + ' with no token on record, across ' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') + '.';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · watchlist' : ' · early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('p', { class: 'sub', text: why }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Sector multiple (' + (row.category || 'Other') + ')' }), el('b', { class: 'num', text: 'x' + fmtMult(row.category_multiplier) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: 'x' + fmtMult(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: 'x' + fmtMult(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chains (' + (row.chains || []).length + ')' }), el('b', { class: 'num', text: 'x' + fmtMult(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price, and "no token" means the snapshot records none.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(spotlight());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();

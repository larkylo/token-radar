// The token radar's model, version 2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers EVERY rankable pre-token protocol in the snapshot (197 in this snapshot:
// all 40 watchlist slugs, 19 rankable protocols above the floor the watchlist rule left out,
// and 138 rankable protocols below the floor), not just the top 200 by TVL. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol);
// the snapshot's live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board. A wrapped, staked or bridged product of a token that
// already trades is not a protocol still waiting on a launch of its own, so the board leaves
// those out by the same rule the house drew its watchlist with: Bridge, Canonical Bridge,
// Cross Chain Bridge, Liquid Staking, Liquid Restaking and Restaked BTC categories, names
// carrying a whole word wrapped, staked or staking, and names beginning with an exchange's
// name, plus exchanges (CEX) and versioned pools.
//
// Implied value follows only from the snapshot's own figures, by one function applied to every
// protocol alike. No protocol name is ever special-cased.
//
//   base        = tvl_usd x category_multiple(category)
//                 The multiple is a sector assumption, applied uniformly by the snapshot's own
//                 category field: a standalone exchange or lender's token is worth more per
//                 dollar of TVL than a wrapped or staked product's, whose value already lives
//                 in the token it wraps. Dexs 0.35, Lending / Yield / Derivatives 0.30,
//                 CDP / Basis Trading 0.28, Risk Curators / Capital Allocators 0.25,
//                 RWA 0.22, Chain / Payments 0.20, Bridge 0.15, Liquid Staking /
//                 Liquid Restaking 0.12, Stablecoin Wrapper 0.10, anything else 0.25.
//   growth      = clamp(change_7d, -60, 120) per cent (missing growth counts as 0)
//   growthMult  = 1 + (growth / 100) x 0.6
//   maturity    = age curve on days since first listing (age unknown: 0.85):
//                 under 90 days the protocol is unproven (0.70-0.80); 90-365 days it earns
//                 trust (0.80-1.00); 1-3 years with no token is the pent-up window (1.00-1.10);
//                 past 3 years with still no token the launch looks less likely, so the
//                 curve eases back (1.10 down to 0.95). Age is how long it has run with no token.
//   chainMult   = 1.00 on one chain, 1.05 on 2-3 chains, 1.10 on 4-9, 1.12 on 10 or more:
//                 multi-chain reach is worth a little, capped so it never dominates.
//   implied     = max(1, round(base x growthMult x maturity x chainMult))
//
// The dashboard states this formula in full, with the category table, and recomputes every row
// from the same figures, so the page, the board and the code are the same arithmetic.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  unknown_age_days: number;
  unknown_age_multiplier: number;
  chain_mult_1: number;
  chain_mult_2_3: number;
  chain_mult_4_9: number;
  chain_mult_10: number;
  default_multiple: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  unknown_age_days: 365,
  unknown_age_multiplier: 0.85,
  chain_mult_1: 1.0,
  chain_mult_2_3: 1.05,
  chain_mult_4_9: 1.1,
  chain_mult_10: 1.12,
  default_multiple: 0.25,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries. Set high on
 *  purpose: the board ranks every rankable protocol below the floor (138 in this snapshot). */
export const EARLY_ROWS = 1000;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The sector multiple for a category: one number per category, applied to every protocol in
 * that category alike. Standalone products earn more per TVL dollar than wrapped, staked or
 * bridged products, whose value already lives in the token they wrap or stake.
 */
export function categoryMultiple(category: string | null): number {
  const c = (category ?? '').toLowerCase();
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
  return MODEL.default_multiple;
}

/**
 * The maturity curve: how long a protocol has run with no token. Young is unproven, one to
 * three years is the pent-up window, and past three years with still no token the launch
 * looks less likely, so the curve eases back down.
 */
export function maturityMultiplier(age: number | null): number {
  if (age === null) return MODEL.unknown_age_multiplier;
  if (age < 90) return 0.7 + (age / 90) * 0.1;
  if (age < 365) return 0.8 + ((age - 90) / 275) * 0.2;
  if (age < 1095) return 1.0 + ((age - 365) / 730) * 0.1;
  return 1.1 - Math.min((age - 1095) / 730, 1) * 0.15;
}

/** The chain-diversity multiplier from how many chains the protocol's TVL sits on. */
export function chainMultiplier(chainCount: number): number {
  if (chainCount >= 10) return MODEL.chain_mult_10;
  if (chainCount >= 4) return MODEL.chain_mult_4_9;
  if (chainCount >= 2) return MODEL.chain_mult_2_3;
  return MODEL.chain_mult_1;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; catMult: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturityMult = maturityMultiplier(age);
  const chainMult = chainMultiplier(protocol.chains.length);
  const catMult = categoryMultiple(protocol.category);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * catMult * growthMult * maturityMult * chainMult));
  return { implied, catMult, growthPct, growthMult, maturityMult, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool,
 *  and not a wrapped, staked or bridged product of a token that already trades (the house's own
 *  watchlist rule, applied to the whole snapshot). */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && !WRAPPED_PRODUCT.test(p.name) && !EXCHANGE_PREFIX.test(p.name) && !WRAPPED_CATEGORY.has(p.category ?? '');
}

/** Categories whose products wrap or stake a token that already trades. */
const WRAPPED_CATEGORY = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** A name carrying a whole word wrapped, staked or staking. */
const WRAPPED_PRODUCT = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor, not just the
  // biggest few by TVL. A chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);
  // Above the floor but off the watchlist: rankable pre-token protocols the house's watchlist
  // rule left out for reasons other than size. The watchlist is the floor, never the ceiling,
  // so they rank too, at their category multiple.
  const above = snapshot.protocols.filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd >= snapshot.floor_usd);
  for (const p of above) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.catMult,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: s.chainMult,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas for one transaction on the protocol's first chain: Ethereum is dear, most other chains are not. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return 'about $8 of gas';
  if (chain === 'Bitcoin' || chain === 'Tron') return 'about $3 of gas';
  return 'under $1 of gas';
}

/** The protocol's farm group, from its category alone. */
type FarmGroup = 'lending' | 'dex' | 'bridge' | 'staking' | 'perps' | 'prediction' | 'curator' | 'stable' | 'rwa' | 'insurance' | 'yield' | 'default';
function groupOf(p: SnapshotProtocol): FarmGroup {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lending';
  if (c.includes('dex') || c.includes('liquidity manager')) return 'dex';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('staking') || c.includes('restak')) return 'staking';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return 'perps';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('curator') || c.includes('allocator')) return 'curator';
  if (c.includes('stable')) return 'stable';
  if (c.includes('rwa')) return 'rwa';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return 'yield';
  return 'default';
}

/** The group's core position: what the farmer actually does first. */
function coreAction(g: FarmGroup, p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (g) {
    case 'lending': return `Supply $${capital} of USDC to ${name} on ${chain} as collateral, at the pool with the deepest liquidity.`;
    case 'dex': return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain}, in the pair with the most volume.`;
    case 'bridge': return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its own app.`;
    case 'staking': return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
    case 'perps': return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position.`;
    case 'prediction': return `Fund $${capital} on ${name} and place one position on a market that closes after the next snapshot.`;
    case 'curator': return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in the farm wallet.`;
    case 'stable': return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold the receipt.`;
    case 'rwa': return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the farm wallet.`;
    case 'insurance': return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full term.`;
    case 'yield': return `Deposit $${capital} into ${name}'s highest-TVL strategy on ${chain} and leave the yield compounding.`;
    default: return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
}

/** The group's second qualifying action: a different interaction, so the wallet is not a one-trick deposit. */
function secondAction(g: FarmGroup, p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  switch (g) {
    case 'lending': return `Borrow $${small} against the supply on ${name}, use it once, then repay it in full the same week.`;
    case 'dex': return `Swap $${small} through ${name}'s pool on ${chain} in the opposite direction, so the wallet both supplies and trades.`;
    case 'bridge': return `Bridge $${small} back through ${name} to the chain you started from, so the wallet is a round-trip user.`;
    case 'staking': return `Claim the staking rewards ${name} pays on ${chain} once, then restake them instead of selling.`;
    case 'perps': return `Close the hedge on ${name} and open a fresh one half the size, so the wallet shows two distinct trades.`;
    case 'prediction': return `Settle or close the first position on ${name}, then place a second one on a different market.`;
    case 'curator': return `Deposit $${small} more into a second ${name} vault on ${chain}, so the wallet holds two vaults.`;
    case 'stable': return `Redeem $${small} of the stable asset back through ${name} on ${chain}, then re-deposit it the next day.`;
    case 'rwa': return `Claim the yield ${name}'s asset paid on ${chain} once and hold the proceeds in the same wallet.`;
    case 'insurance': return `File a test claim check on ${name} (read the policy terms, do not file a false claim) and renew the cover.`;
    case 'yield': return `Harvest the yield ${name} paid on ${chain} once and compound it back into the same strategy.`;
    default: return `Make a second, different interaction with ${name} on ${chain} for $${small}, such as a swap or a vote.`;
  }
}

/** The group's weekly cadence action. */
function weeklyAction(g: FarmGroup, p: SnapshotProtocol): string {
  const name = p.name;
  switch (g) {
    case 'lending': return `Top up the supply or adjust the borrow on ${name} by a small amount each week.`;
    case 'dex': return `Swap a small amount through ${name} each week, keeping the liquidity position untouched.`;
    case 'bridge': return `Bridge a small amount through ${name} each week, alternating direction when the app allows it.`;
    case 'staking': return `Check the staking rewards on ${name} each week and restake whatever has accrued.`;
    case 'perps': return `Rebalance the hedge on ${name} once a week, keeping the margin above the liquidation level.`;
    case 'prediction': return `Place one new market position on ${name} each week, on a market that is still open.`;
    case 'curator': return `Check the vault allocation on ${name} each week and move a small amount to the best-performing vault.`;
    case 'stable': return `Mint or redeem a small amount through ${name} each week, keeping the receipt in the farm wallet.`;
    case 'rwa': return `Check the yield ${name}'s asset paid each week and leave it compounding in the same wallet.`;
    case 'insurance': return `Check the cover on ${name} each week and renew it before it lapses.`;
    case 'yield': return `Harvest and compound the yield on ${name} once a week.`;
    default: return `Make one qualifying action on ${name} each week, such as a deposit, a swap or a vote.`;
  }
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const g = groupOf(p);
  const weeklyGas = chain === 'Ethereum' ? 'about $8 of gas a week' : chain === 'Bitcoin' || chain === 'Tron' ? 'about $3 of gas a week' : 'under $1 of gas a week';
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, keep its seed phrase offline, and open ${p.name} only from the link its own site publishes, never from a search ad.`,
      cost: `${gas} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: coreAction(g, p, capital, chain),
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: secondAction(g, p, capital, chain),
      cost: `about $${Math.max(10, Math.round(capital / 5))} of capital and ${gas}`,
      time: '10 minutes',
    },
    {
      text: weeklyAction(g, p),
      cost: weeklyGas,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and never withdraw and re-deposit in a single day.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open ${p.name}'s own points or rewards page and check whether the wallet earned anything, claiming only from the link that page publishes and never paying a fee to claim.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then unwind in tranches after the snapshot, checking for lockups or withdrawal delays first.`,
      cost: 'nothing but the log',
      time: '5 minutes to log, a day to unwind',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiplier: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

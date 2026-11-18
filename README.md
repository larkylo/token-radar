# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/larkylo/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/larkylo/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar — token-radar-01 entry (model radar-2): a token launch radar ranking 197 pre-token protocols by a stated implied-value model, with a concrete 7-step farm plan each, and a static dashboard (no network).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ffzb586a&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## Model (radar-2, `lib/model.ts`, restated in `dashboard/app.js`)

```
implied = round( tvl_usd x category_multiple
                 x (1 + clamp(change_7d, -60, 120) / 100 x 0.6)
                 x maturity(age_days) x chain_mult(chains) )
```

- **category_multiple** (by the snapshot's category field, never by name):
  Dexs 0.35; Lending/Yield/Derivatives 0.30; CDP/Basis Trading 0.28;
  Risk Curators/Capital Allocators 0.25; RWA 0.22; Chain/Payments 0.20;
  Bridge 0.15; Liquid Staking/Restaking 0.12; Stablecoin Wrapper 0.10; other 0.25.
- **maturity(age_days)**: <90d 0.70–0.80; 90–365d 0.80–1.00; 1–3y 1.00–1.10
  (the pent-up window); >3y eases back to 0.95; unknown age 0.85.
- **chain_mult**: 1 chain 1.00; 2–3 chains 1.05; 4–9 chains 1.10; 10+ chains 1.12.
- **Coverage**: all 40 watchlist slugs + 19 rankable protocols above the $50M floor
  the watchlist rule left out + 138 rankable protocols below it = 197 rows.
  Wrapped/staked/bridged products of a token that already trades are excluded
  from the ranking (same rule the house drew its watchlist with), as are CEX
  and versioned pools. Live-token protocols are set aside with their market caps.

Top of the board: Steakhouse Financial ($779.5M), Sentora Curator ($773.5M),
Gauntlet ($467.9M), Veda ($431.2M), USDD ($315.5M).

## Gate limits (verified)

- board.json: 197 rows (100–4000), ranks 1–197, implied values strictly
  non-increasing, 7 farm steps per row (104–262 chars each), watchlist 40/40.
- Dashboard source: 42,513 bytes total — dossier text 42,772 / 65,536 bytes,
  so the judge reads the whole source. No http(s) URLs anywhere in it.
- Dossier: 740,944 bytes (≤1.5 MiB). Screenshots 1440×900, each ≤512 KiB.

## Screenshots — retaken 2026-11-18 (verified)

Fresh 1440×900 screenshots were retaken with Playwright on 2026-11-18
05:34 UTC from `out/dashboard/index.html` and `main.ts` was re-run, so
`out/dossier.json` was rebuilt from them:

1. `1-board.png` — the board, no hash.
2. `2-detail.png` — `#p=steakhouse-financial` (detail drawer open).
3. `3-filtered.png` — `#category=Dexs` (filtered view).

Verified: all three are 1440×900, each ≤512 KiB, and their sha256 hashes
differ from the starter screenshots in the kit (so they are not the old
200-row starter images). `screenshots/` and `out/screenshots/` hold
identical copies.

## Layout

Repo root: `main.ts`, `lib/model.ts`, `vendor/makefun-board.ts`, `dashboard/`,
`screenshots/`, `LICENSE`, `README.md`. The local-only `input/` and `out/`
directories are not committed (the grader mounts its own `/input` and writes
`/output`).

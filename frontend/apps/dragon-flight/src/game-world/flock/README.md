# Four-bird rounds

`outcome.ts` adds deterministic demo survival schedules to the calibrated base-game
result. It preserves the original total payout for every seed, so the existing 96%
RTP distribution is unchanged. This is a demo presentation partition, not a new
production math export. A successful Champion partitions total return into base
and bonus; a Champion loss retains the entire base return. Feature buys remain
separate, unchanged single-bird routes.

`presentation.ts` owns keyed bird bodies and the shared animation tick. Profiles,
launch style, weather, motion and collisions never determine financial outcomes.
The four frame sets share the existing decoded bitmap cache. Eliminations are
explicit events, not collision tests. Champion Flight is a continuation between
the base destination and the single finalWin event, with no additional play call.

## Live adapter boundary

Legacy RGS `state: [...]` books still decode and replay as their original single
bird. The frontend does not infer survival or Champion outcomes from old payouts.
To enable the new mechanic in live play, the server/math books must provide the
following versioned envelope as `round.state`. Normal modes remain `safe`,
`balanced`, `danger`, with a cost multiplier of 1. Existing feature-buy modes must
continue to supply legacy books.

Example: base x3.00, Champion +x2.00, final x5.00:

```json
{
	"schemaVersion": 2,
	"birds": [
		{ "bird": "woodpecker", "status": "finish" },
		{ "bird": "azure-swift", "status": "finish" },
		{ "bird": "eagle", "status": "finish" },
		{ "bird": "archaeopteryx", "status": "finish" }
	],
	"survivors": 4,
	"baseMultiplierUnits": 300,
	"bonusTriggered": true,
	"bonus": { "bird": "archaeopteryx", "multiplierUnits": 200, "ending": "summitLanding" },
	"events": [
		{ "index": 0, "type": "launch", "path": "balanced" },
		{ "index": 1, "type": "ending", "ending": "ridgeLanding", "multiplierUnits": 300 },
		{ "index": 2, "type": "championFlight", "multiplierUnits": 300 },
		{ "index": 3, "type": "current", "currentType": "risingCurrent", "multiplierUnits": 400 },
		{
			"index": 4,
			"type": "encounter",
			"encounterType": "ridgeDragon",
			"result": "pass",
			"multiplierUnits": 500
		},
		{ "index": 5, "type": "ending", "ending": "summitLanding", "multiplierUnits": 500 },
		{ "index": 6, "type": "finalWin", "multiplierUnits": 500, "payoutMultiplier": 500 }
	]
}
```

Money uses wallet millionths; multiplierUnits and event payoutMultiplier use
hundredths. The enclosing round supplies amount, payout, mode, roundID/betID as
before. Server payout must match amount × final multiplier to within one wallet
unit. Each event index is its zero-based position in the complete stream.

An eliminated bird instead supplies `status: "eliminated"`,
`eliminatedAtEventIndex` and `eliminationReason` (`hunter`, `terrain`, `wind`, `predator`).
That index must point to exactly one matching
`{"type":"elimination","bird":"...","reason":"..."}` event before the base
destination. All base gates pass at flock level; individual failures use these
events. A zero-survivor round has no landing and pays zero.

Exactly four unique birds are required. Four base finishers must trigger exactly
one Champion event immediately after the base destination. Champion failure is
a final encounter with result crash and zero bonus multiplier; its final payout
still includes the base. Champion success ends with a matching landing. Base
plus bonus must equal final multiplier. Inconsistent books fail closed and block
the live session rather than falling back to demo.

Replay uses the same envelope and decoder through the existing GET replay route.
History stores the complete round without generating a new outcome. Only final
settlement records it, once; replay never charges or settles a bet.

## Verification

Run `pnpm test`, `pnpm lint`, `pnpm exec svelte-check --tsconfig ./tsconfig.json`,
and `pnpm build`. Tests cover deterministic models, 300,000 seeded risk rounds,
original RTP/feature-buy math, authoritative decoding with RNG disabled,
malformed books, launch spacing, scheduled eliminations, Champion success/loss,
single settlement, repeated Fly, history and replay accounting.

Do not run a new production math export or upload until authoritative flock
books and their probability tables have been reviewed together. The frontend ZIP
alone cannot enable Champion Flight against older production books.

Normal flock presentation follows authored terrain, wind and encounter types. Only explicit hunter eliminations use targeted bullets; hit flashes and feather effects never decide survival. Numeric health and damage were removed. Fixed Safe/Balanced/Danger volleys use one/two/three shots independently of cosmetic bird choices. The existing placeholder hunter and guns stay visible until the user's custom drawings are ready. Background artwork stays fixed; weather, birds and hazards still animate. Original asset paths and recorded hunter metadata remain compatible. Champion gates, legacy books and feature-buy routes retain their authored outcomes. Dragon encounters use the existing in-world sprite and eliminations use shared-clock feather effects instead of video playback.

## Optional Fluppy Flight

A profitable hunter round offers one separate original single-bird obstacle round at half its net profit, rounded down to cents. Declining retains the winnings. Each attempt consumes the offer, with no Fluppy retry; another hunter win is required. Replays never unlock this offer. Connected play requires a separate authoritative server mode and remains disabled until that mode exists.

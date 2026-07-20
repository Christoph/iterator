---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":115372,\"output\":4478,\"cacheRead\":4186112,\"cacheWrite\":0,\"turns\":15},\"openai-codex/gpt-5.6-sol\":{\"input\":406167,\"output\":1132,\"cacheRead\":1299968,\"cacheWrite\":0,\"turns\":5}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":968435,\"output\":5724,\"cacheRead\":4179968,\"cacheWrite\":0,\"turns\":16}}},\"features\":{\"finalize-auto-plan-review\":{\"input\":1374602,\"output\":6856,\"cacheRead\":5479936,\"cacheWrite\":0,\"turns\":21}},\"featureModels\":{\"finalize-auto-plan-review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":968435,\"output\":5724,\"cacheRead\":4179968,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":406167,\"output\":1132,\"cacheRead\":1299968,\"cacheWrite\":0,\"turns\":5}}}}"
prices: "{}"
timestamp: 2026-07-20T18:16:13.822Z
---

# Usage

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 115372 | 4478 | 4186112 | 0 | 15 | — |
| openai-codex/gpt-5.6-sol | 406167 | 1132 | 1299968 | 0 | 5 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 968435 | 5724 | 4179968 | 0 | 16 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| finalize-auto-plan-review | 1374602 | 6856 | 5479936 | 0 | 21 | — |

Total: 1489974 in / 11334 out / 9666048 cache-read / 0 cache-write over 36 turns. Cost unavailable: add every used model rate.

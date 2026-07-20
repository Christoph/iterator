---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":115372,\"output\":4478,\"cacheRead\":4186112,\"cacheWrite\":0,\"turns\":15},\"openai-codex/gpt-5.6-sol\":{\"input\":406167,\"output\":1132,\"cacheRead\":1299968,\"cacheWrite\":0,\"turns\":5}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":968435,\"output\":5724,\"cacheRead\":4179968,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":370896,\"output\":2721,\"cacheRead\":4590592,\"cacheWrite\":0,\"turns\":14}}},\"features\":{\"finalize-auto-plan-review\":{\"input\":1745498,\"output\":9577,\"cacheRead\":10070528,\"cacheWrite\":0,\"turns\":35}},\"featureModels\":{\"finalize-auto-plan-review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":968435,\"output\":5724,\"cacheRead\":4179968,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":777063,\"output\":3853,\"cacheRead\":5890560,\"cacheWrite\":0,\"turns\":19}}}}"
prices: "{}"
timestamp: 2026-07-20T18:18:22.284Z
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
| openai-codex/gpt-5.6-sol | 370896 | 2721 | 4590592 | 0 | 14 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| finalize-auto-plan-review | 1745498 | 9577 | 10070528 | 0 | 35 | — |

Total: 1860870 in / 14055 out / 14256640 cache-read / 0 cache-write over 50 turns. Cost unavailable: add every used model rate.

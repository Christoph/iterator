---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":237934,\"output\":9168,\"cacheRead\":4968960,\"cacheWrite\":0,\"turns\":24},\"openai-codex/gpt-5.6-sol\":{\"input\":463467,\"output\":3871,\"cacheRead\":1914880,\"cacheWrite\":0,\"turns\":18}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":968435,\"output\":5724,\"cacheRead\":4179968,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":370896,\"output\":2721,\"cacheRead\":4590592,\"cacheWrite\":0,\"turns\":14}},\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":0,\"output\":0,\"cacheRead\":0,\"cacheWrite\":0,\"turns\":1}}},\"features\":{\"finalize-auto-plan-review\":{\"input\":1792296,\"output\":10754,\"cacheRead\":10406400,\"cacheWrite\":0,\"turns\":43},\"retire-plan\":{\"input\":0,\"output\":0,\"cacheRead\":0,\"cacheWrite\":0,\"turns\":1}},\"featureModels\":{\"finalize-auto-plan-review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":968435,\"output\":5724,\"cacheRead\":4179968,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":823861,\"output\":5030,\"cacheRead\":6226432,\"cacheWrite\":0,\"turns\":27}},\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":0,\"output\":0,\"cacheRead\":0,\"cacheWrite\":0,\"turns\":1}}}}"
prices: "{}"
timestamp: 2026-07-20T18:25:32.417Z
---

# Usage

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 237934 | 9168 | 4968960 | 0 | 24 | — |
| openai-codex/gpt-5.6-sol | 463467 | 3871 | 1914880 | 0 | 18 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 968435 | 5724 | 4179968 | 0 | 16 | — |
| openai-codex/gpt-5.6-sol | 370896 | 2721 | 4590592 | 0 | 14 | — |

## hub

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 0 | 0 | 0 | 0 | 1 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| finalize-auto-plan-review | 1792296 | 10754 | 10406400 | 0 | 43 | — |
| retire-plan | 0 | 0 | 0 | 0 | 1 | — |

Total: 2040732 in / 21484 out / 15654400 cache-read / 0 cache-write over 73 turns. Cost unavailable: add every used model rate.

---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5}},\"memory\":{\"openai-codex/gpt-5.6-terra\":{\"input\":260681,\"output\":3539,\"cacheRead\":1991168,\"cacheWrite\":0,\"turns\":9}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":69670,\"output\":4171,\"cacheRead\":3958272,\"cacheWrite\":0,\"turns\":14}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":1476076,\"output\":7475,\"cacheRead\":7436288,\"cacheWrite\":0,\"turns\":39},\"openai-codex/gpt-5.6-sol\":{\"input\":0,\"output\":0,\"cacheRead\":0,\"cacheWrite\":0,\"turns\":1}},\"review\":{\"openai-codex/gpt-5.6-terra\":{\"input\":39405,\"output\":729,\"cacheRead\":1547264,\"cacheWrite\":0,\"turns\":8},\"openai-codex/gpt-5.6-sol\":{\"input\":149627,\"output\":727,\"cacheRead\":90112,\"cacheWrite\":0,\"turns\":3}}},\"features\":{\"retire-plan\":{\"input\":170439,\"output\":1029,\"cacheRead\":1018880,\"cacheWrite\":0,\"turns\":5},\"reset-plan-runtime-state\":{\"input\":1413687,\"output\":4665,\"cacheRead\":8069120,\"cacheWrite\":0,\"turns\":31},\"apply-role-models-manual-turns\":{\"input\":251421,\"output\":4266,\"cacheRead\":1004544,\"cacheWrite\":0,\"turns\":20}}}"
timestamp: 2026-07-17T17:46:27.211Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 170439 | 1029 | 1018880 | 0 | 5 |

## memory

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 260681 | 3539 | 1991168 | 0 | 9 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 69670 | 4171 | 3958272 | 0 | 14 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 1476076 | 7475 | 7436288 | 0 | 39 |
| openai-codex/gpt-5.6-sol | 0 | 0 | 0 | 0 | 1 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 39405 | 729 | 1547264 | 0 | 8 |
| openai-codex/gpt-5.6-sol | 149627 | 727 | 90112 | 0 | 3 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 170439 | 1029 | 1018880 | 0 | 5 |
| reset-plan-runtime-state | 1413687 | 4665 | 8069120 | 0 | 31 |
| apply-role-models-manual-turns | 251421 | 4266 | 1004544 | 0 | 20 |

Total: 2165898 in / 17670 out / 16041984 cache-read / 0 cache-write over 79 turns.

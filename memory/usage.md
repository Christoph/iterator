---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":39930,\"output\":2073,\"cacheRead\":2132480,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":21413,\"output\":4965,\"cacheRead\":3170816,\"cacheWrite\":0,\"turns\":11}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":320231,\"output\":2436,\"cacheRead\":4639744,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":1177132,\"output\":33049,\"cacheRead\":25402368,\"cacheWrite\":0,\"turns\":148}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":1055230,\"output\":4991,\"cacheRead\":6070784,\"cacheWrite\":0,\"turns\":41}}},\"features\":{\"retire-plan\":{\"input\":39930,\"output\":2073,\"cacheRead\":2132480,\"cacheWrite\":0,\"turns\":8},\"backlog-file-mentions\":{\"input\":631890,\"output\":2836,\"cacheRead\":5563904,\"cacheWrite\":0,\"turns\":20},\"backlog-save-during-work\":{\"input\":717690,\"output\":4017,\"cacheRead\":5634048,\"cacheWrite\":0,\"turns\":20},\"backlog-filter-and-bulk-select\":{\"input\":514198,\"output\":13256,\"cacheRead\":8431104,\"cacheWrite\":0,\"turns\":73},\"full-plan-fast-track\":{\"input\":333812,\"output\":11344,\"cacheRead\":6500352,\"cacheWrite\":0,\"turns\":44},\"memory-review-change-focus\":{\"input\":355003,\"output\":9023,\"cacheRead\":9983488,\"cacheWrite\":0,\"turns\":48}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":39930,\"output\":2073,\"cacheRead\":2132480,\"cacheWrite\":0,\"turns\":8}},\"backlog-file-mentions\":{\"openai-codex/gpt-5.6-terra\":{\"input\":320231,\"output\":2436,\"cacheRead\":4639744,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":311659,\"output\":400,\"cacheRead\":924160,\"cacheWrite\":0,\"turns\":4}},\"backlog-save-during-work\":{\"openai-codex/gpt-5.6-sol\":{\"input\":717690,\"output\":4017,\"cacheRead\":5634048,\"cacheWrite\":0,\"turns\":20}},\"backlog-filter-and-bulk-select\":{\"openai-codex/gpt-5.6-sol\":{\"input\":514198,\"output\":13256,\"cacheRead\":8431104,\"cacheWrite\":0,\"turns\":73}},\"full-plan-fast-track\":{\"openai-codex/gpt-5.6-sol\":{\"input\":333812,\"output\":11344,\"cacheRead\":6500352,\"cacheWrite\":0,\"turns\":44}},\"memory-review-change-focus\":{\"openai-codex/gpt-5.6-sol\":{\"input\":355003,\"output\":9023,\"cacheRead\":9983488,\"cacheWrite\":0,\"turns\":48}}}}"
prices: "{}"
timestamp: 2026-07-20T15:21:48.737Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 39930 | 2073 | 2132480 | 0 | 8 | — |

## plan

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 21413 | 4965 | 3170816 | 0 | 11 | — |

## implement

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 320231 | 2436 | 4639744 | 0 | 16 | — |
| openai-codex/gpt-5.6-sol | 1177132 | 33049 | 25402368 | 0 | 148 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 1055230 | 4991 | 6070784 | 0 | 41 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 39930 | 2073 | 2132480 | 0 | 8 | — |
| backlog-file-mentions | 631890 | 2836 | 5563904 | 0 | 20 | — |
| backlog-save-during-work | 717690 | 4017 | 5634048 | 0 | 20 | — |
| backlog-filter-and-bulk-select | 514198 | 13256 | 8431104 | 0 | 73 | — |
| full-plan-fast-track | 333812 | 11344 | 6500352 | 0 | 44 | — |
| memory-review-change-focus | 355003 | 9023 | 9983488 | 0 | 48 | — |

Total: 2613936 in / 47514 out / 41416192 cache-read / 0 cache-write over 224 turns. Cost unavailable: add every used model rate.

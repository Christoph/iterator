---
type: Usage
title: Token usage
description: Per-step model/token ledger and optional project-owned pricing for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":39930,\"output\":2073,\"cacheRead\":2132480,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":21413,\"output\":4965,\"cacheRead\":3170816,\"cacheWrite\":0,\"turns\":11}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":320231,\"output\":2436,\"cacheRead\":4639744,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":990019,\"output\":14589,\"cacheRead\":11044864,\"cacheWrite\":0,\"turns\":69}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":513898,\"output\":2173,\"cacheRead\":3185152,\"cacheWrite\":0,\"turns\":21}}},\"features\":{\"retire-plan\":{\"input\":39930,\"output\":2073,\"cacheRead\":2132480,\"cacheWrite\":0,\"turns\":8},\"backlog-file-mentions\":{\"input\":631890,\"output\":2836,\"cacheRead\":5563904,\"cacheWrite\":0,\"turns\":20},\"backlog-save-during-work\":{\"input\":717690,\"output\":4017,\"cacheRead\":5634048,\"cacheWrite\":0,\"turns\":20},\"backlog-filter-and-bulk-select\":{\"input\":474568,\"output\":12345,\"cacheRead\":7671808,\"cacheWrite\":0,\"turns\":66}},\"featureModels\":{\"retire-plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":39930,\"output\":2073,\"cacheRead\":2132480,\"cacheWrite\":0,\"turns\":8}},\"backlog-file-mentions\":{\"openai-codex/gpt-5.6-terra\":{\"input\":320231,\"output\":2436,\"cacheRead\":4639744,\"cacheWrite\":0,\"turns\":16},\"openai-codex/gpt-5.6-sol\":{\"input\":311659,\"output\":400,\"cacheRead\":924160,\"cacheWrite\":0,\"turns\":4}},\"backlog-save-during-work\":{\"openai-codex/gpt-5.6-sol\":{\"input\":717690,\"output\":4017,\"cacheRead\":5634048,\"cacheWrite\":0,\"turns\":20}},\"backlog-filter-and-bulk-select\":{\"openai-codex/gpt-5.6-sol\":{\"input\":474568,\"output\":12345,\"cacheRead\":7671808,\"cacheWrite\":0,\"turns\":66}}}}"
prices: "{}"
timestamp: 2026-07-20T15:08:18.455Z
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
| openai-codex/gpt-5.6-sol | 990019 | 14589 | 11044864 | 0 | 69 | — |

## review

| model | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 513898 | 2173 | 3185152 | 0 | 21 | — |

## Per feature

| feature | input | output | cache read | cache write | turns | cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 39930 | 2073 | 2132480 | 0 | 8 | — |
| backlog-file-mentions | 631890 | 2836 | 5563904 | 0 | 20 | — |
| backlog-save-during-work | 717690 | 4017 | 5634048 | 0 | 20 | — |
| backlog-filter-and-bulk-select | 474568 | 12345 | 7671808 | 0 | 66 | — |

Total: 1885491 in / 26236 out / 24173056 cache-read / 0 cache-write over 125 turns. Cost unavailable: add every used model rate.

# Web Delivery v1 Canonical Capacity

狀態：`CANONICAL`

生效日期：2026-09-14

工作線狀態：`C = STANDBY`

基準 Repository HEAD：`bbfeb8a49e5e9ef51461c809724df1ee737f8f47`

本文件固定已通過 Phase 4 production-like 驗證的 Web Delivery v1 架構、容量範圍與操作門檻。容量數值代表 `KNOWN_GOOD_BASELINE`，不代表理論最大容量，也不作為正式服務的硬體上限。

## Canonical architecture

### HTTP boundary

HTTP 保留以下資料與操作：

- initial snapshot
- typed player commands
- quest
- inventory
- ownership
- cold state

### SSE boundary

SSE 只承載高頻 `combat delta`。Combat SSE 不承載完整角色狀態、quest、inventory、ownership、relationship、mood、journal、karma、guild 或 social。

玩家進入戰鬥頁或 reconnect 時，先由 HTTP snapshot 取得 cursor 與 combat revision，再建立 Combat SSE。玩家命令維持 typed HTTP command。

### Observation boundary

Web observation 固定包含：

- Interest Set
- NO_WEB headless observation
- per-character projection
- viewer multiplexing
- single-flight request coalescing
- bounded backpressure

角色 simulation、戰鬥、任務、掉落、ownership 與 persistence 持續運作。沒有有效 Web viewer 時停止 browser-oriented high-frequency projection 與 combat serialization。

同一角色的多個 viewer 共用一份 producer 與 projection。每角色最多 8 個 viewer；每 viewer queue 上限為 16 frames 或 64 KiB。revision gap、resume window 過期或 queue 超限時要求重新 snapshot。

## SSE domain rule

未來 domain 的預設 delivery policy：

| Domain | 預設策略 |
| --- | --- |
| Relationship | event-driven、low-frequency 或 on-demand |
| Mood | low-frequency 或 on-demand |
| Journal | event-driven 或 on-demand |
| Karma | major-event-driven |
| Guild | event-driven 或 low-frequency |
| Social | event-driven 或 low-frequency |

任何新 domain 在加入高頻 transport 前，必須先定義 Interest Set、authority、revision source、payload、頻率、cache、backpressure、UX gate 與獨立容量證據。未完成評估時不得加入 Combat SSE。

## KNOWN_GOOD_BASELINE

| 指標 | 已驗證值 |
| --- | ---: |
| Concurrent viewers | 1,000 PASS |
| Combat foreground viewers | 1,000 PASS |
| Reconnect burst | 1,000 / 1,000 PASS |
| External combat p95 | 143 至 147ms |
| Event-loop p95 | 26.43ms |
| Event-loop p99 | 31.54ms |
| Event-loop max | 45.48ms |
| Peak CPU | 2.69% |
| Peak heap | 141.7 MiB |
| Peak RSS | 263.8 MiB |
| Peak network | 4.08 MB/s |
| Origin sockets | 1,001 |
| Node handles | 1,004 |
| SSE errors | 0 |
| Revision gaps | 0 |
| Critical event loss | 0 |

此基準來自 10 個 load-generator processes、每 viewer 獨立 TLS／snapshot／SSE connection，經 DNS、Cloudflare TLS edge、4 條 QUIC Tunnel connection 與 isolated Node origin 的完整外部路徑。正式 `play.g8land.com` direct canary p50／p95／p99 為 141／143／143ms。

## Operational thresholds

所有時間型門檻使用 5 分鐘 rolling window。Heap growth 與 RSS growth 使用 30 分鐘 rolling window，並觀察 GC 後低點。單次瞬時尖峰保留事件紀錄；只有符合下表持續條件才升級狀態。

| 指標 | NORMAL | WARNING | CRITICAL |
| --- | --- | --- | --- |
| SSE error rate | `< 0.1%` | `0.1% 至 0.5%` | `> 0.5%`，或連續拒絕正常 viewer |
| Reconnect rate | `< 1% active viewers/min` | `1% 至 5%/min` | `> 5%/min`，或 reconnect failure `> 0.5%` |
| Event-loop p95 | `≤ 50ms` | `> 50ms 且 ≤ 100ms` | `> 100ms`；頻繁 max `> 500ms` 同樣為 CRITICAL |
| Combat-visible p95 | `≤ 200ms` | `> 200ms 且 ≤ 300ms` | `> 300ms` |
| Heap used | `≤ 177 MiB` 且 GC 後無單向成長 | `> 177 MiB 且 ≤ 283 MiB`，或連續 15 分鐘成長 | `> 283 MiB`，或連續 30 分鐘單向成長 |
| RSS | `≤ 330 MiB` 且穩定 | `> 330 MiB 且 ≤ 528 MiB`，或連續 15 分鐘成長 | `> 528 MiB`，或連續 30 分鐘單向成長 |
| Queue backlog | steady queue `0` | 非零 queue 持續 10 秒，或達單 viewer 上限 25% | 任一 viewer 達 16 frames／64 KiB 後仍未 resnapshot，或 backlog 持續成長 |
| Revision gap | `0` | gap 發生且自動 resnapshot 成功 | 任一 gap 無法 recovery |
| Critical event loss | `0` | 待 reconciliation 的疑似遺失 | 確認遺失 `> 0` |
| Origin socket count | `≤ 1,200` | `> 1,200 且 < 13,107` | `≥ 13,107`，或 proxy／origin 開始拒絕連線 |
| Network throughput | `≤ 5.10 MB/s` | `> 5.10 且 ≤ 8.16 MB/s` | `> 8.16 MB/s`，或出現 packet loss／delivery timeout |

Heap、RSS 與 network 的初始門檻分別採已驗證峰值的 125% 作為 WARNING 起點、200% 作為 CRITICAL 起點。Socket CRITICAL 採 Windows 16,384 個動態連接埠的 80%，即 13,107。這些是操作警戒線，後續只能用新一輪 production-like evidence 調整。

### Operational response

- `NORMAL`：維持例行監控與現行架構。
- `WARNING`：確認 viewer mix、reconnect、queue、event-loop、DB contributor 與最近 domain 變更；暫停擴大流量。
- `CRITICAL`：停止擴大 viewer、關閉新增 rollout、保留證據；Combat SSE 異常時使用已驗證 polling fallback，必要時執行 canonical rollback。

## Future scale trigger

只有出現任一條件，才重新啟動工作線 C：

- concurrent Web viewers 長時間接近 700 至 800
- event-loop p95 明顯高於 26.43ms baseline，並進入 WARNING
- combat-visible p95 進入 250 至 300ms 區間或達 CRITICAL
- SSE reconnect error 增加並進入 WARNING
- heap 或 RSS 持續成長並進入 WARNING
- DB 再次成為主要 latency 或 resource contributor
- Social、Journal 或其他新 domain 使 projection 負載進入 WARNING
- 預計突破 1,000 concurrent viewers

未觸發以上條件時，`C = STANDBY`。

## DB pool decision

`DB_POOL = DEFER`

Phase 4 最終 production observation 為約 0.2 process/s，沒有 query storm，DB 未成為主要 latency 或 resource contributor。只有 DB 成為實測瓶頸時才重新評估 connection pool。

## Evidence and rollback identity

- Evidence：`.local/ro-stack/evidence/PHASE4_1000_SSE_CANONICAL/summary.json`
- Evidence SHA256：`d5f229eb38b30303866562b3799a1123c6157a549a4a50a3f13dfdc43dfb10d3`
- Evidence verdict：`1000_USER_WEB_READY`
- Rollback artifact：`.local/ro-stack/deployments/PHASE2_CANONICAL_DEPLOYMENT.zip`
- Rollback SHA256：`392bf7f4ed2af5b0f1217de3a673c77f2d71bf7bc74ddcf866029c487c214572`
- Rollback verify-only result：`PHASE2_CANONICAL_RESTORE_PASS`

上述兩個 SHA256 已於 2026-09-14 重新由本機檔案計算並與 evidence record 一致。

## Capacity freeze

Web Delivery v1 固定為：

```text
HTTP snapshot + typed HTTP commands + cold-domain HTTP
+ Combat-only SSE delta
+ Interest Set + NO_WEB
+ per-character projection + viewer multiplexing + single-flight
+ bounded queue + resnapshot recovery + polling fallback
```

本次 capacity freeze 不加入 Redis、WebSocket、DB pool、Kafka、RabbitMQ、其他 streaming protocol、multi-region 或新 realtime domain。未取得新容量證據前，`KNOWN_GOOD_BASELINE` 維持 1,000 concurrent viewers。

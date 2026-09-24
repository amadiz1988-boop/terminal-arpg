# Web canonical GitHub lineage reconciliation V1

Audit freeze: `2026-09-24`. Scope: committed history in `origin/main..1d16484b82230b4bf2f6727b3bae8551675a5a41`. The working tree, including active W2 work, is outside this range. The per-commit inventory is [web-main-lineage-commit-audit-v1.json](web-main-lineage-commit-audit-v1.json). Its 271 records include SHA, subject, date, author, changed paths, identifiable workline, classification, and evidence. `UNKNOWN=0` for classification of this frozen range.

| Git fact | Value |
| --- | --- |
| `LOCAL_HEAD` | `1d16484b82230b4bf2f6727b3bae8551675a5a41` |
| `ORIGIN_MAIN_HEAD` | `6b61e318927ffe3e624cbc707b315ca3b051fd3e` |
| `MERGE_BASE` | `265c1f7b8f08601cd68517d64c36aacf57aa6e9d` |
| `LOCAL_AHEAD_COUNT` | 271 |
| `LOCAL_BEHIND_COUNT` | 5 |
| `RECONCILIATION_SHAPE` | `PUBLICATION_BLOCKED` |

Classification totals: `ACCEPTED_CANONICAL=124`, `CURRENT_ACCEPTED_DEPENDENCY=128`, `HISTORICAL_ONLY=8`, `SENSITIVE_OR_SECRET_RISK=11`, `WIP_NOT_CANONICAL=0`, `GENERATED_OR_ARTIFACT=0`, `UNKNOWN=0`. The risk category identifies publication review, and is not a finding of a leaked credential. The eight historical records are shadow social and Life Director experiments; project governance retains them as historical references. The generated M1 map projection remains a current accepted dependency because the active source suite relies on its exact committed input.

## Security and publication review

The [history scan](web-main-lineage-security-scan-v1.json) enumerated 4,090 local-only Git objects, including 2,619 blobs. It inspected 1,465 text blobs, including all detected text blobs up to 10 MB. Seven credential-shaped matches were reviewed in their source context: three Rogue quest answers, one mocked OAuth response, and three test-only metadata/password fixtures. `SECRET_RISK_COUNT=0` confirmed from those findings. The scan reports no flagged dump, backup, log, or private-key paths. Its boundary is the local-only Git range and detectable text/path patterns; it does not establish an independent legal right to redistribute binary assets.

`PUBLICATION_BLOCKER_COUNT=11` local commits containing RO client-derived or collaboration binary art/audio. Their SHAs and file inventories are in the per-commit JSON: `8cdda11c`, `1b724123`, `ebd77c9b`, `f22dcafe`, `5eb6971f`, `7e358046`, `087dbc94`, `b4fd0353`, `50d2a264`, `1a67113b`, `5beb3a39`. These include body/hair sprites, minimaps, floors, skill icons, a world map, teleport audio, and Tamadora art. [RO asset policy](../RO_OFFICIAL_UI_ASSET_POLICY.md) records local-client use and extraction authorization. [Third-party notices](../../THIRD_PARTY_NOTICES.md) records that the Stone Age asset redistribution terms are unconfirmed. The available records do not establish permission to publish these assets in the canonical Web GitHub repository. No legal conclusion about ownership is inferred.

Safe remediation requires documented repository redistribution rights for each affected asset family, or an approved source/asset separation and coordinated Git ancestry plan. No history rewrite, selective reconstruction, push, or Production action was performed. Because the remote has five commits outside local ancestry, a plain fast-forward is also unavailable after the publication blocker is resolved. Reconcile the five remote-only governance commits with the approved source lineage, then incorporate the closed W2 candidate and verify the resulting exact SHA before a coordinated `main` promotion.

## Accepted checkpoints and promotion state

`git merge-base --is-ancestor` succeeded against frozen `LOCAL_HEAD` for M1 `76487252f4257ec3b51cbc61c4d37f1ead40634e` and governance checkpoints `043c8a91`, `d405ce28`, `4a6fa17c17f659e2e1932342dcbed91e70501e70`, and `1d16484b82230b4bf2f6727b3bae8551675a5a41`. Thus `CURRENT_ACCEPTED_WEB_HISTORY_COVERED=YES` and `GOVERNANCE_HISTORY_COVERED=YES` in local committed ancestry. These checks do not confer GitHub reachability or authorize Production deployment. `W2_STATUS=ACTIVE`; its dirty and untracked changes were excluded.

`WEB_MAIN_PROMOTION=BLOCKED`. The target remains `https://github.com/amadiz1988-boop/terminal-arpg.git`, branch `main`. A later approved promotion must preserve true ancestry where publication rights allow, account for the five remote-only commits, include the separately accepted W2 closure, and verify an exact GitHub-reachable SHA. The Production release gate still requires explicit approval and a receipt for that SHA.

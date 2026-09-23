# M1 original combat audio source-language gate, 2026-09-24

This is a read-only provenance audit. No audio asset or event mapping was changed, and no Production Browser playback was accepted.

## Existing deployed-source evidence

The existing project mapping is `docs/RO_OFFICIAL_COMBAT_AUDIO_MAP.md`; the per-file original GRF path, web output, byte count and SHA-256 are in `public/ro/client/sfx/official/combat-manifest.json`. The pinned client archive is `data0.grf` SHA-256 `913402ace1d3c67818b4f070650a07eb157a6d62df9e394d596d59b4c7e6678a`. Existing weapon-hit, monster-ACT, player-damage and warp mappings are project mappings. The 22 entries in `docs/ro-ui-sound-index.json` have `clientBehaviorVerified=false`; their names alone do not establish original client trigger semantics.

| GAME_EVENT | SOURCE_CLIENT | ORIGINAL_GRF_PATH | ORIGINAL_FILENAME | ORIGINAL_LANGUAGE | DECODED_NAME | SOURCE_REFERENCE | SHA256 | WEB_DERIVATIVE | MAPPING_CONFIDENCE | VERIFIED_BY |
|---|---|---|---|---|---|---|---|---|---|---|
| Dagger physical hit | Taiwan official `data0.grf` | `data/wav/_hit_dagger.wav` | `_hit_dagger.wav` | ASCII | Same as original | Existing combat audio map, weapon table | `4aad76270e549dec2100d2601503d1b2de6dae01e22ccbce3dbf739d62d48a6f` | `public/ro/client/sfx/official/_hit_dagger.wav` | Project mapping; original-client event timing unverified | GRF manifest hash and prior project mapping |
| Poring damage | Same | `data/wav/poring_damage.wav` | `poring_damage.wav` | ASCII | Same as original | Existing combat audio map, Poring ACT table | `0ef1ecc8602c650a7b0c9f185ecac7019c624ce046a7c11215d27f6c9e5451f8` | `public/ro/client/sfx/official/poring_damage.wav` | ACT-based project mapping; live timing unverified | Prior ACT audit and manifest |
| Male player damage | Same | `data/wav/damage_male.wav` | `damage_male.wav` | ASCII | Same as original | Existing combat audio map, player damage section | `31262171cd3970f1bcdb7bf4636a3e6a5b5b46615ba18d9b2d2cc58fca9e773e` | `public/ro/client/sfx/official/damage_male.wav` | Character-context project mapping; live timing unverified | Prior project mapping and manifest |
| Teleport / map warp | Same | `data/wav/effect/warp.wav` | `warp.wav` | ASCII | Same as original | Existing combat audio map, UI event table | `d74f63cb03879178d647ee3a3982a93b7ee949083e20e6bc3e8c7ea5715cbe08` | `public/ro/client/sfx/official/warp.wav` | Project mapping; must remain separate from HIT audio | Prior project mapping and manifest |
| Critical hit, miss, generic skill cast, skill hit, death | Same | UNRESOLVED per event | UNRESOLVED | Korean, Japanese and encoded candidates not semantically matched | UNRESOLVED | No exact client trigger reference established in this audit | N/A | No new derivative | `AUDIO_MAPPING=UNRESOLVED` | None |

## Foreign-language and encoded filename search

Read-only `GRF.Core.GrfHolder` enumeration used the authorized local `data.grf`, `data0.grf` and `event.grf`; CP949 decoding was selected before listing. WAV entries: `237`, `3106`, `0`; entries with Hangul/CJK in the decoded path: `0`, `160`, `0`. A Korean-token search for `공격`, `피격`, `크리`, `죽`, `사망`, `텔레`, `워프`, `스킬`, `데미지`, `회복`, `몬스터`, `타격` returned four paths, including `data/wav/effect/t_공격력.wav` and `data/wav/effect/사망의골짜기에서.wav`. These are candidates by spelling only; neither has an accepted HIT/death mapping.

A separate CP932 listing returned `237`, `3057`, `0` WAV names and 19 kana-like paths in `data0.grf`, but sample paths were mojibake from Korean bytes. It supplies no reliable JRO semantic evidence. No new sound was extracted, remapped or deployed. rAthena authoritative `MONSTER_HIT` and event IDs remain the required playback trigger; actual one-event/one-sound, mute/unmute, and timing acceptance remain unmeasured until controlled Production Browser testing.

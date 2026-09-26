-- Preserve canonical phase names in the PA read model. Forward-only widening;
-- gameplay state and existing rows are unchanged.
ALTER TABLE `persistent_agent_live_status`
  MODIFY COLUMN `runtime_phase` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  NOT NULL DEFAULT 'IDLE';

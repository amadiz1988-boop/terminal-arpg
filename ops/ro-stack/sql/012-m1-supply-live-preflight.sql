-- M1 farm-map supply preflight projection. The native map-server writes these
-- nullable fields from rAthena. Web fails closed while they are absent or NULL.
-- Native repeats the predicate before stopping a farm and before teleporting.
ALTER TABLE `persistent_agent_live_status`
  ADD COLUMN IF NOT EXISTS `inventory_slots` int unsigned NULL,
  ADD COLUMN IF NOT EXISTS `inventory_max_slots` int unsigned NULL,
  ADD COLUMN IF NOT EXISTS `weight` int unsigned NULL,
  ADD COLUMN IF NOT EXISTS `max_weight` int unsigned NULL,
  ADD COLUMN IF NOT EXISTS `supply_required` tinyint(1) NULL,
  ADD COLUMN IF NOT EXISTS `supply_reason` varchar(64) NULL;

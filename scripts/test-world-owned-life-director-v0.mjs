import assert from 'node:assert/strict';
import {
  CONTROL_AUTHORITY,
  DecisionReasonCode,
  InterruptType,
  MacroGoal,
  PLAYER_CONTROL_PATH,
  applyLifeDirectorEvent,
  assertInterruptShape,
  createWorldOwnedLifeState,
  projectLifeDirectorState,
} from './world-owned-life-director-v0.mjs';

const checks = [];
function check(label, fn) {
  try {
    fn();
    checks.push({ label, ok: true });
    console.log(`PASS  ${label}`);
  } catch (error) {
    checks.push({ label, ok: false, error });
    console.log(`FAIL  ${label}: ${error.message}`);
  }
}

const initial = createWorldOwnedLifeState({ charId: 190001, initialGoal: MacroGoal.HUNT });
check('WORLD_OWNED has no player control path', () => {
  assert.equal(initial.CONTROL_AUTHORITY, CONTROL_AUTHORITY);
  assert.equal(initial.PLAYER_CONTROL_PATH, PLAYER_CONTROL_PATH);
  assert.equal(initial.CURRENT_MACRO_GOAL, MacroGoal.HUNT);
});
check('required V0 macro goals are declared', () => {
  assert.deepEqual(Object.values(MacroGoal), ['HUNT', 'SUPPLY', 'RECOVER', 'QUEST', 'SOCIAL_BREAK', 'IDLE']);
});
check('initial HUNT is represented in the goal stack', () => {
  assert.deepEqual(initial.GOAL_STACK.map((entry) => entry.goal), [MacroGoal.HUNT]);
  assert.deepEqual(initial.DECISION_REASON_CODES, [DecisionReasonCode.INITIAL_GOAL]);
  assert.equal(initial.EVENT_LEDGER[0].decision.actor, 'SELF');
});

const continued = applyLifeDirectorEvent(initial, { type: 'CONTINUE', boundary: true, boundaryType: 'NATURAL_REEVALUATION' });
check('continuity is the default formal candidate', () => {
  assert.equal(continued.accepted, true);
  assert.equal(continued.state.CURRENT_MACRO_GOAL, MacroGoal.HUNT);
  assert.equal(continued.decision.selectedAction, 'CONTINUE_CURRENT_ACTIVITY');
  assert.deepEqual(continued.decision.candidates.map((candidate) => candidate.action), ['CONTINUE_CURRENT_ACTIVITY']);
  assert.deepEqual(continued.decision.reasonCodes, [DecisionReasonCode.CONTINUITY_DEFAULT]);
});
const skipped = applyLifeDirectorEvent(continued.state, { type: 'CONTINUE', boundary: false });
check('no decision is made without an explicit decision boundary', () => {
  assert.equal(skipped.state.DECISION_SEQUENCE, continued.state.DECISION_SEQUENCE);
  assert.equal(skipped.decision.selectedAction, 'NO_DECISION');
  assert.deepEqual(skipped.decision.reasonCodes, [DecisionReasonCode.REEVALUATION_NOT_DUE]);
});

const supply = applyLifeDirectorEvent(continued.state, { type: 'SUPPLY_REQUIRED', cause: 'LOW_RECOVERY_RESERVE' });
check('SUPPLY interrupt pushes parent HUNT and stores resume target', () => {
  assert.equal(supply.state.CURRENT_MACRO_GOAL, MacroGoal.SUPPLY);
  assert.deepEqual(supply.state.GOAL_STACK.map((entry) => entry.goal), [MacroGoal.HUNT, MacroGoal.SUPPLY]);
  assert.equal(supply.state.INTERRUPT.type, InterruptType.SUPPLY);
  assert.equal(supply.state.RESUME_TARGET, MacroGoal.HUNT);
  assert.deepEqual(supply.decision.reasonCodes, [DecisionReasonCode.SUPPLY_REQUIRED]);
  assertInterruptShape(supply.state);
});
const supplied = applyLifeDirectorEvent(supply.state, { type: 'SUPPLY_COMPLETE' });
check('supply completion resumes the parent HUNT goal', () => {
  assert.equal(supplied.state.CURRENT_MACRO_GOAL, MacroGoal.HUNT);
  assert.deepEqual(supplied.state.GOAL_STACK.map((entry) => entry.goal), [MacroGoal.HUNT]);
  assert.equal(supplied.state.INTERRUPT, null);
  assert.equal(supplied.state.RESUME_TARGET, null);
  assert.deepEqual(supplied.decision.reasonCodes, [DecisionReasonCode.SUPPLY_COMPLETE]);
});

const danger = applyLifeDirectorEvent(supplied.state, { type: 'DANGER_DETECTED', cause: 'HP_CRITICAL' });
check('danger creates a RECOVER interrupt with HUNT as parent', () => {
  assert.equal(danger.state.CURRENT_MACRO_GOAL, MacroGoal.RECOVER);
  assert.deepEqual(danger.state.GOAL_STACK.map((entry) => entry.goal), [MacroGoal.HUNT, MacroGoal.RECOVER]);
  assert.equal(danger.state.INTERRUPT.type, InterruptType.RECOVER);
  assert.equal(danger.state.RESUME_TARGET, MacroGoal.HUNT);
  assert.deepEqual(danger.decision.reasonCodes, [DecisionReasonCode.DANGER_DETECTED]);
});
const recovered = applyLifeDirectorEvent(danger.state, { type: 'RECOVER_COMPLETE' });
check('recovery completion resumes the same parent goal', () => {
  assert.equal(recovered.state.CURRENT_MACRO_GOAL, MacroGoal.HUNT);
  assert.deepEqual(recovered.state.GOAL_STACK.map((entry) => entry.goal), [MacroGoal.HUNT]);
  assert.equal(recovered.state.INTERRUPT, null);
  assert.deepEqual(recovered.decision.reasonCodes, [DecisionReasonCode.RECOVERY_COMPLETE]);
});

check('player decision authority is rejected and leaves gameplay state unchanged', () => {
  const result = applyLifeDirectorEvent(recovered.state, { type: 'PLAYER_SET_GOAL', actor: 'PLAYER' });
  assert.equal(result.accepted, false);
  assert.equal(result.state.CURRENT_MACRO_GOAL, MacroGoal.HUNT);
  assert.deepEqual(result.state.GOAL_STACK.map((entry) => entry.goal), [MacroGoal.HUNT]);
  assert.deepEqual(result.decision.reasonCodes, [DecisionReasonCode.PLAYER_CONTROL_FORBIDDEN]);
});
check('projection exposes the required contract and no Web command surface', () => {
  const projection = projectLifeDirectorState(recovered.state);
  for (const field of ['CONTROL_AUTHORITY', 'CURRENT_MACRO_GOAL', 'GOAL_STACK', 'INTERRUPT', 'RESUME_TARGET', 'DECISION_REASON_CODES'])
    assert.ok(Object.hasOwn(projection, field), `missing ${field}`);
  assert.equal(Object.hasOwn(projection, 'PLAYER_COMMAND'), false);
  assert.equal(projection.PLAYER_CONTROL_PATH, 'NONE');
});
check('same deterministic event sequence produces the same projection', () => {
  const replay = [
    { type: 'CONTINUE', boundary: true, boundaryType: 'NATURAL_REEVALUATION' },
    { type: 'SUPPLY_REQUIRED', cause: 'LOW_RECOVERY_RESERVE' },
    { type: 'SUPPLY_COMPLETE' },
    { type: 'DANGER_DETECTED', cause: 'HP_CRITICAL' },
    { type: 'RECOVER_COMPLETE' },
  ].reduce((state, event) => applyLifeDirectorEvent(state, event).state, createWorldOwnedLifeState({ charId: 190001 }));
  assert.deepEqual(projectLifeDirectorState(replay), projectLifeDirectorState(recovered.state));
});

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} WORLD_OWNED Life Director V0 checks passed`);
if (failed.length) process.exitCode = 1;

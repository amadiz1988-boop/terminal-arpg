// Presentation-only sequencing. The Dashboard response and live projection
// remain the authority for accepting travel and confirming arrival.
export function createWorldMapTeleportPresentation(adapter) {
  let state = 'IDLE';
  let generation = 0;
  let arrived = false;
  let audioComplete = false;
  let destination = null;

  const stage = (next) => {
    state = next;
    adapter.onStage(next);
  };
  const active = () => ['PREFLIGHT_PENDING', 'TELEPORT_CONFIRMED',
    'FINAL_TELEPORT', 'WAIT_FOR_ARRIVAL'].includes(state);
  const stopSelection = () => {
    adapter.stopCue('readyPortal');
    adapter.stopCue('portal');
  };
  const stopTransition = () => {
    adapter.stopCue('warp');
    adapter.stopCue('flyWing');
  };
  const finish = () => {
    if (!arrived || !audioComplete || !active()) return;
    const completed = destination;
    stage('ARRIVED');
    adapter.resumeBgm(completed.mapId);
    adapter.onComplete(completed);
  };
  const fail = (error) => {
    generation += 1;
    stopSelection();
    stopTransition();
    destination = null;
    arrived = false;
    audioComplete = false;
    stage('IDLE');
    adapter.resumeBgm();
    adapter.onFailure(error);
  };

  return {
    get state() { return state; },
    isTransitionActive: active,
    open() {
      if (state !== 'IDLE' && state !== 'ARRIVED') return false;
      generation += 1;
      arrived = false;
      audioComplete = false;
      destination = null;
      stage('MAP_PORTAL_OPEN');
      // A and sustained B begin together; neither starts a game command.
      void adapter.playCue('readyPortal').catch(adapter.onFailure);
      void adapter.playCue('portal', { loop: true }).catch(adapter.onFailure);
      return true;
    },
    beginSubmission() {
      if (state !== 'MAP_PORTAL_OPEN') return false;
      stage('PREFLIGHT_PENDING');
      return true;
    },
    preflightRejected() {
      if (state !== 'PREFLIGHT_PENDING') return false;
      stage('MAP_PORTAL_OPEN');
      return true;
    },
    preflightAccepted(nextDestination) {
      if (state !== 'PREFLIGHT_PENDING' || !nextDestination?.mapId)
        return false;
      destination = nextDestination;
      stopSelection();
      adapter.pauseBgm();
      const ticket = ++generation;
      stage('TELEPORT_CONFIRMED');
      void (async () => {
        try {
          const warp = await adapter.playCue('warp');
          if (ticket !== generation || warp !== 'ended') return;
          stage('FINAL_TELEPORT');
          const teleport = await adapter.playCue('flyWing');
          if (ticket !== generation || teleport !== 'ended') return;
          audioComplete = true;
          if (arrived) finish();
          else stage('WAIT_FOR_ARRIVAL');
        } catch (error) {
          if (ticket === generation) fail(error);
        }
      })();
      return true;
    },
    authoritativeArrival(mapId) {
      if (!active() || destination?.mapId !== mapId) return false;
      arrived = true;
      finish();
      return true;
    },
    failed(error) {
      if (!active()) return false;
      fail(error);
      return true;
    },
    cancel() {
      if (active()) return false;
      generation += 1;
      stopSelection();
      stopTransition();
      destination = null;
      arrived = false;
      audioComplete = false;
      stage('IDLE');
      return true;
    },
    dispose() {
      generation += 1;
      stopSelection();
      stopTransition();
      stage('IDLE');
      adapter.pauseBgm();
    },
  };
}

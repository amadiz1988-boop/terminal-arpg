import { JobQuestService } from './job-quest-service.mjs';
import { ROGUE_JOB_ADAPTER } from './rogue-adapter.mjs';

export class RogueQuestService extends JobQuestService {
  constructor({ runtimeService, bridge }) {
    super({ runtimeService, bridge, adapter: ROGUE_JOB_ADAPTER });
  }
}

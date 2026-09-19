import { ASSASSIN_JOB_ADAPTER } from './assassin-adapter.mjs';
import { JobQuestService } from './job-quest-service.mjs';

export class AssassinQuestService extends JobQuestService {
  constructor({ runtimeService, bridge }) {
    super({ runtimeService, bridge, adapter: ASSASSIN_JOB_ADAPTER });
  }
}

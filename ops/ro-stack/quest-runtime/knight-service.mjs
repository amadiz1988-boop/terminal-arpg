import { JobQuestService } from './job-quest-service.mjs';
import { KNIGHT_JOB_ADAPTER } from './knight-adapter.mjs';

export class KnightQuestService extends JobQuestService {
  constructor({ runtimeService, bridge }) {
    super({ runtimeService, bridge, adapter: KNIGHT_JOB_ADAPTER });
  }
}

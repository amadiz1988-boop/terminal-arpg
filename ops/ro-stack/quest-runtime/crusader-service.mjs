import { JobQuestService } from './job-quest-service.mjs';
import { CRUSADER_JOB_ADAPTER } from './crusader-adapter.mjs';

export class CrusaderQuestService extends JobQuestService {
  constructor({ runtimeService, bridge }) {
    super({ runtimeService, bridge, adapter: CRUSADER_JOB_ADAPTER });
  }
}

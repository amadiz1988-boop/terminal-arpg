export const RO_RULESET = Object.freeze({
  name: 'rAthena Renewal',
  repository: 'https://github.com/rathena/rathena',
  commit: 'e985006171d2eb320ee512a653f4c83aea3d81b6',
});

export const AUTOMATION_RULESET = Object.freeze({
  name: 'OpenKore',
  repository: 'https://github.com/OpenKore/openkore',
  commit: '51de1ddfc4449ae5217f6886de702f87ca934030',
});

export type SourceTrace = Readonly<{
  repository: string;
  commit: string;
  path: string;
  symbol?: string;
}>;

export function rAthenaSource(path: string, symbol?: string): SourceTrace {
  return { repository: RO_RULESET.repository, commit: RO_RULESET.commit, path, symbol };
}

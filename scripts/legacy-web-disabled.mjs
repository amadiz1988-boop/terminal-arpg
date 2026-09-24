const command = process.argv[2] ?? 'unknown';

console.error(
  `LEGACY_WEB_ARCHIVED command=${command} current=http://127.0.0.1:8788/`,
);
process.exitCode = 1;

/** Beli access is paused; do not read credentials or contact its backend. */
console.error('Beli network access is paused by user request. Existing exports remain available for offline analysis.');
process.exitCode = 1;

/**
 * CLI UI Helpers — Lightweight progress indicators and error recovery.
 *
 * Minimal helpers for CLI interactivity. No external deps.
 */

/**
 * Print a progress step indicator.
 * Each call prints a numbered step with a checkmark.
 */
let _stepCounter = 0;

export function resetSteps(): void {
  _stepCounter = 0;
}

export function step(message: string): void {
  _stepCounter++;
  console.log(`  [${_stepCounter}] → ${message}`);
}

/**
 * Print a success summary.
 */
export function success(message: string): void {
  console.log(`  ✓ ${message}`);
}

/**
 * Print a warning.
 */
export function warn(message: string): void {
  console.log(`  ⚠ ${message}`);
}

/**
 * Print a failure with recovery suggestion.
 */
export function fail(message: string, recovery?: string): void {
  console.log(`  ✗ ${message}`);
  if (recovery) {
    console.log(`    💡 ${recovery}`);
  }
}

/**
 * Print an info tip.
 */
export function tip(message: string): void {
  console.log(`  ℹ ${message}`);
}

/**
 * Format a duration in ms to human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const remS = Math.round(s % 60);
  return `${m}m ${remS}s`;
}

/**
 * Print a simple spinner-like progress message.
 * Updates in place by clearing the line.
 */
export function progress(message: string): void {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const idx = Math.floor(Date.now() / 100) % spinner.length;
  process.stdout.write(`\r  ${spinner[idx]} ${message}`);
}

/**
 * Clear the progress line (call after progress()).
 */
export function clearProgress(): void {
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
}

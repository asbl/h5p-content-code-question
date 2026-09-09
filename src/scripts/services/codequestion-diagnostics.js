/**
 * Returns whether verbose diagnostic logging is enabled.
 * @param {object} [options] Runtime or tester options.
 * @returns {boolean} True when diagnostics should be written to the console.
 */
export function isCodeQuestionDiagnosticsEnabled(options = {}) {
  return options?.enableDiagnosticLogs === true;
}

/**
 * Writes a diagnostic warning only when the author enabled it.
 * @param {object} options Runtime or tester options.
 * @param {...*} args Arguments forwarded to console.warn.
 * @returns {void}
 */
export function logCodeQuestionDiagnostic(options, ...args) {
  if (isCodeQuestionDiagnosticsEnabled(options)) {
    console.warn(...args);
  }
}

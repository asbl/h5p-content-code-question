import TestCaseComparator from '../components/comparator';

/**
 * Decodes HTML entities in testcase text before comparison.
 * @param {*} value - Text value from expected or actual output.
 * @returns {string} Decoded text.
 */
function decodeHtmlEntities(value) {
  const normalizedValue = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'output')
    ? value.output
    : value;
  const text = String(normalizedValue ?? '');

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalizeOutputLines(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => decodeHtmlEntities(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => line.trim()));
}

/**
 * IOComparator is responsible for checking if the output of a test case
 * matches the expected output.
 */
export class IOComparator extends TestCaseComparator {
  constructor(...args) {
    super(...args);

    /**
     * Structured reason for the most recent failed comparison, or null when
     * the last comparison passed (or none has run yet). Consumed by the
     * tester/view layer to show a concrete, actionable failure message
     * instead of a bare ✗, so a student can see *why* a test failed instead
     * of having to guess (e.g. an invisible stray blank print() line).
     * @type {object|null}
     */
    this.lastMismatchReason = null;
  }

  /**
   * Runs the test case comparison.
   * @param {number} testCaseIndex - Current test case index.
   * @param {object} testCase - The test case object containing the expected outputs.
   * @param {string[]} output - Array of strings representing the actual stdout outputs.
   * @returns {boolean} True if the test passes (all expected outputs match actual outputs).
   */
  compare(testCaseIndex, testCase, output) {
    this.lastMismatchReason = null;

    const expectedOutput = normalizeOutputLines(testCase.outputs);
    const actualOutput = normalizeOutputLines(output);

    // No expected output and no actual output → pass
    if (!expectedOutput.length && !actualOutput.length) {
      return true;
    }

    // Expected output missing but actual output exists → fail
    if (!testCase.outputs) {
      return false;
    }

    // More output than expected → fail. This commonly happens when the
    // student's code prints one extra (sometimes blank/whitespace-only and
    // therefore easy to miss visually) line beyond what the test case
    // expects, so the concrete counts are recorded for the UI.
    if (actualOutput.length > expectedOutput.length) {
      this.lastMismatchReason = {
        type: 'lineCountMismatch',
        expectedCount: expectedOutput.length,
        actualCount: actualOutput.length,
      };
      return false;
    }

    // Compare each expected output line with actual output line, recording
    // the first line that differs (including a missing/undefined actual
    // line, i.e. fewer output lines than expected).
    const mismatchIndex = expectedOutput.findIndex((value, index) => (
      value !== actualOutput[index]
    ));

    if (mismatchIndex === -1) {
      return true;
    }

    this.lastMismatchReason = {
      type: 'lineContentMismatch',
      line: mismatchIndex + 1,
      expectedValue: expectedOutput[mismatchIndex],
      actualValue: actualOutput[mismatchIndex],
    };
    return false;
  }

  /**
   * Returns structured details about why the last compare() call failed.
   * @returns {object|null} Mismatch details, or null if the last comparison
   *   passed or compare() has not run yet.
   */
  getLastMismatchReason() {
    return this.lastMismatchReason;
  }
}

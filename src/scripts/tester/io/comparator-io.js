import TestCaseComparator from '../components/comparator';

/**
 * Decodes HTML entities in testcase text before comparison.
 * @param {*} value - Text value from expected or actual output.
 * @returns {string} Decoded text.
 */
function decodeHtmlEntities(value) {
  const text = String(value ?? '');

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

/**
 * IOComparator is responsible for checking if the output of a test case
 * matches the expected output.
 */
export class IOComparator extends TestCaseComparator {
  /**
   * Runs the test case comparison.
   * @param {number} testCaseIndex - Current test case index.
   * @param {object} testCase - The test case object containing the expected outputs.
   * @param {string[]} output - Array of strings representing the actual stdout outputs.
   * @returns {boolean} True if the test passes (all expected outputs match actual outputs).
   */
  compare(testCaseIndex, testCase, output) {
    const expectedOutput = testCase.outputs ?? [];

    // No expected output and no actual output → pass
    if (!expectedOutput.length && !output.length) {
      return true;
    }

    // Expected output missing but actual output exists → fail
    if (!testCase.outputs) {
      return false;
    }

    // More output than expected → fail
    if (output.length > expectedOutput.length) {
      return false;
    }

    // Compare each expected output line with actual output line
    return expectedOutput.every((value, index) => (
      decodeHtmlEntities(value) === decodeHtmlEntities(output[index])
    ));
  }
}

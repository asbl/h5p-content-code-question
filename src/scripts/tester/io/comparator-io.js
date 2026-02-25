import TestCaseComparator from '../components/comparator';

/**
 * IOComparator is responsible for checking if the output of a test case
 * matches the expected output.
 */
export class IOComparator extends TestCaseComparator {
  /**
   * Runs the test case comparison.
   * @param testCaseIndex
   * @param {object} testCase - The test case object containing the expected outputs.
   * @param {string[]} actualOutput - Array of strings representing the actual stdout outputs.
   * @param output
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
    return expectedOutput.every((value, index) => value === output[index]);
  }
}

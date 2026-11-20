/**
 * Represents the aggregated results of a test run consisting of multiple test cases.
 */
export default class TestResult {
  /**
   * Creates a new TestResult instance.
   * @param {number} testcaseCount - The total number of test cases.
   * @param {number[]} weights Positive integer points for each test case.
   */
  constructor(testcaseCount, weights = []) {
    /**
     * Stores the result of each test case.
     * Each entry is represented as:
     * - 1: test case passed
     * - 0: test case failed
     * @type {number[]}
     */
    this.testcaseCount = testcaseCount;
    this.weights = Array.from({ length: testcaseCount }, (_, index) => {
      const weight = Number(weights[index] ?? 1);
      return Number.isInteger(weight) && weight > 0 && weight <= 100 ? weight : 1;
    });
    this.results = new Array(this.testcaseCount).fill(0);
  }

  reset() {
    this.results = new Array(this.testcaseCount).fill(0);
  }

  /**
   * Sets the result for a specific test case.
   * @param {number} index - The index of the test case.
   * @param {boolean} passed - Indicates whether the test case passed.
   * @returns {void}
   */
  setResult(index, passed) {
    this.results[index] = passed ? 1 : 0;
  }

  /**
   * Calculates the total score of the test run.
   * @returns {number} The number of test cases that passed.
   */
  getScore() {
    return this.results.reduce((sum, r, index) => sum + r * this.weights[index], 0);
  }

  getSingleScore(index) {
    if (!this.results[index]) return 0;
    return this.results[index];
  }

  /**
   * Returns the maximum achievable score.
   * @returns {number} The total number of test cases.
   */
  getMaxScore() {
    return this.weights.reduce((sum, weight) => sum + weight, 0);
  }

  getRelativeScore() {
    const maxScore = this.getMaxScore();
    if (maxScore === 0) {
      return 0;
    }

    return this.getScore() / maxScore;
  }

  getFullCompletedScore() {
    if (this.getMaxScore() === 0) {
      return 0;
    }

    if (this.getRelativeScore() < 1) {
      return 0;
    }
    else {
      return 1;
    }
  }
}

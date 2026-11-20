import CodeTester from '../tester';
import TablesComparator, { normalizeComparisonOptions } from './comparator-tables';
import TablesView from './view-tables';

/**
 * Compares the result table of a learner query with the result table of the
 * reference solution.
 *
 * Every test case runs the reference solution and the learner query against
 * the same database state (a test case may extend the shared database with
 * additional setup SQL) and compares the two result tables according to the
 * authored comparison options. An optional structural check of the query text
 * (required/forbidden keywords, ...) applies to all test cases.
 */
export default class TablesTester extends CodeTester {
  constructor(
    testcases,
    gradingMethod,
    onEvaluateTest,
    runtimeFactory,
    l10n,
    dueDate,
    enableDueDate,
    solutionCode,
    functionName,
    algorithmConstraints,
    algorithmTrace,
    options = {},
  ) {
    // A tester without authored cases still evaluates exactly one comparison.
    const cases = Array.isArray(testcases) && testcases.length > 0 ? testcases : [{}];
    const legacyTarget = Array.isArray(solutionCode) ? solutionCode : [];

    super(
      cases,
      gradingMethod,
      onEvaluateTest,
      runtimeFactory,
      l10n,
      dueDate,
      enableDueDate,
      Array.isArray(solutionCode) ? undefined : solutionCode,
      functionName,
      algorithmConstraints,
      algorithmTrace,
      options,
    );

    this.comparisonOptions = normalizeComparisonOptions(this.options.comparison);
    this.targetTables = [];
    this.resultTables = [];
    this.comparisons = [];
    this.queryConstraintResult = null;
    this.targetTable = legacyTarget;
    this.resultTable = [];
    this.runSolution = true;
    this.view.comparisonOptions = this.comparisonOptions;
    if (legacyTarget.length) this.view.setTargetTable(legacyTarget, 0);
  }

  /**
   * @returns {TablesView} The view for the tester object
   */
  viewFactory() {
    return new TablesView(this.l10n, this.session, [], {
      dueDate: this.dueDate,
      enableDueDate: this.enableDueDate,
    });
  }

  /**
   * @returns {TablesView} The view for the tester object
   */
  getView() {
    return this.view;
  }

  /**
   * @returns {TablesComparator} A Tables-Comparator
   */
  comparatorFactory() {
    return new TablesComparator();
  }

  reset() {
    super.reset();
    this.targetTables = [];
    this.resultTables = [];
    this.comparisons = [];
    this.queryConstraintResult = null;
    this.targetTable = [];
    this.resultTable = [];
  }

  /**
   * Stores the reference result of the active test case.
   * @param {Array} table Result tables of the reference solution.
   */
  setTargetTable(table) {
    const index = this.session.getCurrentTestCaseIndexNumber();
    this.targetTables[index] = table || [];
    this.targetTable = this.targetTables[index];
    this.view.setTargetTable(this.targetTables[index], index);
  }

  /**
   * Stores the learner result of the active test case.
   * @param {Array} tableOutput Result tables of the learner query.
   */
  addOutput(tableOutput) {
    const index = this.session.getCurrentTestCaseIndexNumber();
    this.resultTables[index] = tableOutput || [];
    this.resultTable = this.resultTables[index];
    this.view.setResultTable(this.resultTables[index], index);
  }

  /**
   * Stores the outcome of the structural query check.
   * @param {{passed: boolean, violations: string[], checks: object[]}|null} result Check result.
   */
  setQueryConstraintResult(result) {
    this.queryConstraintResult = result || null;
    this.view.setQueryConstraintResult(this.queryConstraintResult);
  }

  hasQueryConstraints() {
    return Array.isArray(this.queryConstraintResult?.checks)
      && this.queryConstraintResult.checks.length > 0;
  }

  compareCase(index) {
    return this.comparator.getComparisonDetails(
      this.targetTables[index] || [],
      this.resultTables[index] || [],
      this.comparisonOptions,
    );
  }

  /**
   * Evaluates the active test case: result table and query requirements.
   * @returns {Promise<void>} Resolves when the case is graded and displayed.
   */
  async evaluateTestCase() {
    const index = this.session.getCurrentTestCaseIndexNumber();
    const comparison = this.compareCase(index);
    this.comparisons[index] = comparison;
    this.lastComparison = comparison;

    const constraintsPassed = !this.hasQueryConstraints() || this.queryConstraintResult.passed === true;
    const passed = comparison.identical && constraintsPassed;
    const reason = !comparison.identical
      ? { type: 'tableMismatch', comparison }
      : (!constraintsPassed
        ? { type: 'queryConstraintMismatch', violations: this.queryConstraintResult.violations }
        : null);

    this.results.setResult(index, passed);
    this.view.update(index, this.resultTables[index], passed, reason);
    this.view.updateLearningGoals?.(this.results);
  }

  /**
   * Compares the active test case without recording a result.
   * @returns {boolean} True if the learner result matches the reference.
   */
  checkTestCase() {
    const comparison = this.compareCase(this.session.getCurrentTestCaseIndexNumber());
    this.lastComparison = comparison;
    return comparison.identical;
  }

  /**
   * All-or-nothing score; weighted partial credit reads `results` directly.
   * @returns {number} 1 if every test case passed, otherwise 0.
   */
  getScore() {
    return this.results.getFullCompletedScore();
  }

  /**
   * Describes the first problem of the last evaluation.
   * @returns {{type: string, comparison?: object, violations?: string[], testIndex?: number}|null}
   *   First failure ('incomplete' if a case was never graded), or null if everything passed.
   */
  getFirstFailure() {
    for (let index = 0; index < this.results.results.length; index++) {
      if (this.results.results[index]) continue;
      const comparison = this.comparisons[index];
      if (!comparison) {
        // The learner query failed (or was stopped) before this case was graded.
        return { type: 'incomplete', testIndex: index };
      }
      if (!comparison.identical) {
        return { type: 'tableMismatch', comparison, testIndex: index };
      }
      if (this.hasQueryConstraints() && !this.queryConstraintResult.passed) {
        return {
          type: 'queryConstraintMismatch',
          violations: this.queryConstraintResult.violations,
          testIndex: index,
        };
      }
    }

    return null;
  }
}

import CodeTester from '../tester';
import TablesComparator from './comparator-tables';
import TablesView from './view-tables';

export default class TablesTester extends CodeTester {
  constructor(
    testcases,
    gradingMethod,
    onEvaluateTest,
    runtimeFactory,
    l10n,
    dueDate,
    enableDueDate,
    targetTable,
  ) {
    super(
      testcases,
      gradingMethod,
      onEvaluateTest,
      runtimeFactory,
      l10n,
      dueDate,
      enableDueDate,
    );
    this.targetTable = targetTable || [];
    this.resultTable = [];
    this.view = new TablesView(this.l10n, this.session, this.targetTable);
    this.runSolution = true;
  }

  /**
   *
   * @returns {TablesView} The view for the tester object
   */
  getView()  {
    return this.view;
  }

  setTargetTable(table) {
    this.targetTable = table;
    this.view.setTargetTable(table);
  }

  addOutput(tableOutput) {
    this.resultTable = tableOutput || [];
    this.view.setResultTable(this.resultTable);
  }

  checkTestCase() {
    this.lastComparison = this.comparator.getComparisonDetails(this.targetTable, this.resultTable);
    return this.lastComparison.identical;
  }

  getScore() {
    return this.checkTestCase() ? 1 : 0;
  }

  /**
   *
   * @returns {TablesComparator} A Tables-Comparator
   */
  comparatorFactory() {
    return new TablesComparator();
  }


}

import ImageTester from './image/tester-image';
import IOTester from './io/tester-io';
import TablesTester from './tables/tester-tables';

export default class CodeTesterFactory {
  constructor(
    testcases,
    gradingMethod,
    onEvaluate,
    runtimeFactory,
    l10n,
    dueDate,
    enableDueDate,
    solutionCode
  ) {
    this.testcases = testcases;
    this.gradingMethod = gradingMethod;
    this.onEvaluate = onEvaluate;
    this.runtimeFactory = runtimeFactory;
    this.l10n = l10n;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
    this.solutionCode = solutionCode;
  }

  create() {
    const testerMap = {
      ioTestCases: IOTester,
      targetImage: ImageTester,
      bySolution: TablesTester,
    };
    const TesterClass = testerMap[this.gradingMethod];
    if (!TesterClass) return null;

    const commonArgs = [
      this.testcases,
      this.gradingMethod,
      () => {
        this.onEvaluate();
      },
      this.runtimeFactory,
      this.l10n,
      this.dueDate,
      this.enableDueDate,
      this.solutionCode,
    ];
    return new TesterClass(...commonArgs);
  }
}
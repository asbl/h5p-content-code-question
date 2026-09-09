import ImageTester from './image/tester-image';
import IOTester from './io/tester-io';
import TablesTester from './tables/tester-tables';
import FunctionTester from './function/tester-function';

export default class CodeTesterFactory {
  constructor(
    testcases,
    gradingMethod,
    onEvaluate,
    runtimeFactory,
    l10n,
    dueDate,
    enableDueDate,
    solutionCode,
    functionName = '', algorithmConstraints = {}, algorithmTrace = {}, enableDiagnosticLogs = false,
  ) {
    this.testcases = testcases;
    this.gradingMethod = gradingMethod;
    this.onEvaluate = onEvaluate;
    this.runtimeFactory = runtimeFactory;
    this.l10n = l10n;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
    this.solutionCode = solutionCode;
    this.functionName = functionName;
    this.algorithmConstraints = algorithmConstraints;
    this.algorithmTrace = algorithmTrace;
    this.enableDiagnosticLogs = enableDiagnosticLogs === true;
  }

  create() {
    const testerMap = {
      ioTestCases: IOTester,
      targetImage: ImageTester,
      bySolution: TablesTester,
      functionTests: FunctionTester,
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
      this.functionName,
      this.algorithmConstraints,
      this.algorithmTrace,
      { enableDiagnosticLogs: this.enableDiagnosticLogs },
    ];
    return new TesterClass(...commonArgs);
  }
}

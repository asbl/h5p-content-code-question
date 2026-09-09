import TestCaseView from '../components/view-tester.js';
import DateHandler from '../components/date-handler.js';
import { getCodeQuestionL10nValue, tCodeQuestion } from '../../services/codequestion-l10n.js';

/** Displays function calls and their return values without using HTML input. */
export default class FunctionTesterView extends TestCaseView {
  constructor(l10n, session, functionName, dueDate, enableDueDate = false) {
    super();
    this.l10n = l10n;
    this.session = session;
    this.functionName = functionName;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
    this.algorithmConstraintResult = null;
    this.algorithmTraceEvents = [];
    this.algorithmTraceStep = 0;
  }

  setAlgorithmConstraintResult(result) {
    this.algorithmConstraintResult = result;
  }

  setAlgorithmTraceEvents(events) {
    this.algorithmTraceEvents = Array.isArray(events) ? events : [];
    this.algorithmTraceStep = Math.max(0, this.algorithmTraceEvents.length - 1);
    this.renderTrace();
  }

  renderTrace() {
    const panel = this.getTestCasesAreaDiv()?.querySelector('.algorithm-trace');
    if (!panel) return;
    panel.replaceChildren();
    if (!this.algorithmTraceEvents.length) return;
    const event = this.algorithmTraceEvents[this.algorithmTraceStep];
    const controls = document.createElement('div');
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = '←';
    previous.disabled = this.algorithmTraceStep === 0;
    previous.onclick = () => {
      this.algorithmTraceStep--;
      this.renderTrace();
    };
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = '→';
    next.disabled = this.algorithmTraceStep === this.algorithmTraceEvents.length - 1;
    next.onclick = () => {
      this.algorithmTraceStep++;
      this.renderTrace();
    };
    const label = document.createElement('span');
    label.textContent = tCodeQuestion(this.l10n, 'algorithmTraceStep', {
      step: event.step,
      total: this.algorithmTraceEvents.length,
      type: event.type,
    });
    controls.append(previous, label, next);
    const snapshot = this.algorithmTraceEvents.slice(0, this.algorithmTraceStep + 1)
      .reverse().find((item) => Array.isArray(item.snapshot))?.snapshot || [];
    const array = document.createElement('div'); array.className = 'algorithm-trace__array';
    snapshot.forEach((value, index) => {
      const cell = document.createElement('span');
      cell.className = 'algorithm-trace__cell';
      if (event.indices?.includes(index)) cell.classList.add('algorithm-trace__cell--active');
      if (event.index === index) cell.classList.add('algorithm-trace__cell--marked');
      cell.textContent = `${index}: ${String(value)}`;
      array.appendChild(cell);
    });
    const detail = document.createElement('div');
    detail.textContent = event.indices
      ? tCodeQuestion(this.l10n, 'algorithmTraceIndices', { indices: event.indices.join(', ') })
      : (event.label || '');
    panel.append(controls, array, detail);
  }

  update(index, output, passed) {
    const row = this.getTestCasesAreaDiv()?.querySelector(`.table-testcase-${index} tbody tr`);
    if (!row) return;

    const result = Array.isArray(output) ? output[0] : null;
    const detail = result?.detail || '--';
    const outputCell = row.querySelector('.output');
    const violations = this.algorithmConstraintResult?.violations || [];
    const constraintDetail = violations.length
      ? ` ${tCodeQuestion(this.l10n, 'functionTesterConstraintDetail', { violations: violations.join(', ') })}`
      : '';
    outputCell.textContent = result?.status === 'error'
      ? `${getCodeQuestionL10nValue(this.l10n, 'functionTesterError')}: ${detail}${constraintDetail}`
      : `${detail}${constraintDetail}`;
    row.classList.toggle('test-passed', passed);

    const statusCell = row.querySelector('.passed');
    statusCell.textContent = passed ? '✓' : '✗';
    statusCell.setAttribute('aria-label', passed
      ? (this.l10n.testPassed || 'Test passed')
      : (this.l10n.testFailed || 'Test failed'));
  }

  getDOM() {
    const testCasesArea = super.getDOM();
    const fragment = document.createDocumentFragment();

    if (this.enableDueDate && this.dueDate) {
      fragment.appendChild(new DateHandler(this.dueDate, this.l10n).getDueDateMeta());
    }

    this.session.testcases.forEach((testCase, index) => {
      const container = document.createElement('div');
      container.className = 'table-testcase-container function-tester';

      const heading = document.createElement('h3');
      heading.textContent = `${this.l10n.testCase || 'Test case'} ${index + 1}`;
      container.appendChild(heading);

      const table = document.createElement('table');
      table.className = `table-testcase table-testcase-${index}`;
      const headerRow = document.createElement('tr');
      [
        getCodeQuestionL10nValue(this.l10n, 'functionTesterCall'),
        getCodeQuestionL10nValue(this.l10n, 'functionTesterExpectedResult'),
        getCodeQuestionL10nValue(this.l10n, 'functionTesterActualResult'),
        this.l10n.passed || getCodeQuestionL10nValue(this.l10n, 'passed'),
      ].forEach((label) => {
        const header = document.createElement('th');
        header.scope = 'col';
        header.textContent = label;
        headerRow.appendChild(header);
      });
      const thead = document.createElement('thead');
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const row = document.createElement('tr');
      const argumentsText = (testCase.arguments || [])
        .map((argument) => String(argument?.argument ?? argument ?? ''))
        .join(', ');
      const call = `${this.functionName}(${argumentsText})`;
      const values = testCase.hidden
        ? [this.l10n.hidden || '[hidden]', this.l10n.hidden || '[hidden]']
        : [call, String(testCase.expectedResult ?? '')];

      values.forEach((value, cellIndex) => {
        const cell = document.createElement('td');
        cell.className = cellIndex === 0 ? 'input' : 'expected';
        cell.textContent = value;
        row.appendChild(cell);
      });
      const output = document.createElement('td');
      output.className = 'output';
      output.setAttribute('aria-live', 'polite');
      row.appendChild(output);
      const passed = document.createElement('td');
      passed.className = 'passed';
      passed.setAttribute('aria-live', 'polite');
      row.appendChild(passed);

      const body = document.createElement('tbody');
      body.appendChild(row);
      table.appendChild(body);
      container.appendChild(table);
      fragment.appendChild(container);
    });

    testCasesArea.replaceChildren(fragment);
    const trace = document.createElement('section');
    trace.className = 'algorithm-trace';
    const title = document.createElement('h3');
    title.textContent = getCodeQuestionL10nValue(this.l10n, 'algorithmTrace');
    trace.appendChild(title);
    testCasesArea.appendChild(trace);
    this.renderTrace();
    return testCasesArea;
  }
}

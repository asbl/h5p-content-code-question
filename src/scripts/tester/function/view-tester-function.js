import { testCaseTitle, updateTestHint, renderLearningGoals, renderOutputDifference } from '../components/testcase-feedback';
import TestCaseView from '../components/view-tester.js';
import DateHandler from '../components/date-handler.js';
import { getCodeQuestionL10nValue, tCodeQuestion } from '../../services/codequestion-l10n.js';
import { describeFailureReason, setPassedCellStatus } from '../components/failure-reason.js';
import { formatFunctionTestValue } from '../../services/function-test-values.js';

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
    this.renderConstraintStatus();
  }

  /**
   * Shows the task's structure requirement (e.g. "a while loop must be used")
   * once, separate from the per-call results, so both can be judged on their own.
   */
  renderConstraintStatus() {
    const area = this.getTestCasesAreaDiv();
    if (!area) return;

    let section = area.querySelector('.algorithm-constraint-status');
    const result = this.algorithmConstraintResult;
    if (!result) {
      section?.remove();
      return;
    }

    if (!section) {
      section = document.createElement('section');
      section.className = 'algorithm-constraint-status';
      section.setAttribute('aria-live', 'polite');
      const summary = area.querySelector('.testcases-summary');
      area.insertBefore(section, summary ? summary.nextSibling : area.firstChild);
    }

    const violations = Array.isArray(result.violations) ? result.violations : [];
    const met = result.passed === true && violations.length === 0;
    section.classList.toggle('is-met', met);
    section.classList.toggle('is-violated', !met);

    const mark = document.createElement('span');
    mark.className = 'algorithm-constraint-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = met ? '✓' : '✗';

    const title = document.createElement('strong');
    title.textContent = getCodeQuestionL10nValue(this.l10n, 'algorithmConstraintTitle');

    const text = document.createElement('span');
    text.className = 'algorithm-constraint-text';
    text.textContent = met
      ? getCodeQuestionL10nValue(this.l10n, 'algorithmConstraintMet')
      : describeFailureReason(this.l10n, { type: 'algorithmConstraintMismatch', violations, constraints: result.constraints });

    section.replaceChildren(mark, title, document.createTextNode(' '), text);
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
    panel.hidden = !this.algorithmTraceEvents.length;
    if (!this.algorithmTraceEvents.length) return;
    const title = document.createElement('h3');
    title.textContent = getCodeQuestionL10nValue(this.l10n, 'algorithmTrace');
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
    panel.append(title, controls, array, detail);
  }

  update(index, output, passed, _reason = null) {
    const row = this.getTestCasesAreaDiv()?.querySelector(`.table-testcase-${index} tbody tr`);
    if (!row) return;

    const result = Array.isArray(output) ? output[0] : null;
    const detail = this.session.testcases[index]?.hidden
      ? (this.l10n.hidden || '[hidden]') : (result?.detail || '--');
    const outputCell = row.querySelector('.output');
    outputCell.textContent = ['error', 'configuration'].includes(result?.status)
      ? getCodeQuestionL10nValue(this.l10n, 'functionTesterNoResult')
      : detail;
    const testCase = this.session.testcases[index];
    const functionReason = result && result.status !== 'passed' ? {
      type: 'functionResultMismatch',
      status: result.status,
      detail: result.detail,
    } : null;
    // The structure requirement is reported once in its own section, so a
    // correct return value keeps its check mark in the row.
    const rowPassed = passed || (result?.status === 'passed' && !functionReason);
    row.classList.toggle('test-passed', rowPassed);
    updateTestHint(row, testCase, rowPassed, this.l10n);
    if (!rowPassed && !testCase.hidden && result?.status === 'failed') {
      renderOutputDifference(outputCell, formatFunctionTestValue(testCase.expectedResult), detail);
    }
    setPassedCellStatus(row.querySelector('.passed'), this.l10n, rowPassed, testCase.hidden ? null : functionReason);
  }

  updateLearningGoals(results) {
    renderLearningGoals(this, results);
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
      heading.textContent = testCaseTitle(this.l10n, testCase, index);
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
        .map((argument) => formatFunctionTestValue(argument?.argument ?? argument))
        .join(', ');
      const call = `${this.functionName}(${argumentsText})`;
      const values = testCase.hidden
        ? [this.l10n.hidden || '[hidden]', this.l10n.hidden || '[hidden]']
        : [call, formatFunctionTestValue(testCase.expectedResult)];

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
    trace.hidden = true;
    testCasesArea.appendChild(trace);
    this.renderTrace();
    this.renderConstraintStatus();
    return testCasesArea;
  }
}

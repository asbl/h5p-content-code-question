import TestCaseView from '../components/view-tester';
import DateHandler from '@scripts/tester/components/date-handler';
import { tCodeQuestion } from '../../services/codequestion-l10n';

/**
 * Renders a list of values as text with visual line breaks.
 * @param {HTMLElement} element - Target cell.
 * @param {Array<*>} values - Values to render.
 * @returns {void}
 */
function setMultilineText(element, values = []) {
  const lines = Array.isArray(values) ? values : [];
  const fragment = document.createDocumentFragment();

  lines.forEach((value, index) => {
    if (index > 0) {
      fragment.append(document.createElement('br'));
    }
    fragment.append(document.createTextNode(String(value ?? '')));
  });

  element.replaceChildren(fragment);
}

// Spezifische Implementierung für IO Testcases
export class IOTesterView extends TestCaseView {
  constructor(l10n, session, dueDate, enableDueDate = false) {
    super();
    this.l10n = l10n;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
    this.session = session;
  }

  update(testCaseIndex, output, passed, mismatchReason = null) {
    if (!this.getTestCasesAreaDiv()) return;
    const row = this.getTestCasesAreaDiv().querySelector(
      `.table-testcase-${testCaseIndex} tbody tr`,
    );
    if (!row) return;
    const outputCell = row.querySelector('.output');
    setMultilineText(outputCell, output?.length ? output : ['--']);
    row.classList.toggle('test-passed', passed);
    this.setPassedCellStatus(row.querySelector('.passed'), passed, mismatchReason);
  }

  /**
   * Turns a structured comparator mismatch reason into a localized,
   * human-readable sentence.
   * @param {object|null} mismatchReason - Reason from IOComparator.
   * @returns {string} Localized description, or '' if there is none.
   */
  describeMismatchReason(mismatchReason) {
    if (!mismatchReason) {
      return '';
    }

    if (mismatchReason.type === 'lineCountMismatch') {
      return tCodeQuestion(this.l10n, 'outputLineCountMismatch', {
        actual: mismatchReason.actualCount,
        expected: mismatchReason.expectedCount,
      });
    }

    if (mismatchReason.type === 'lineContentMismatch') {
      return tCodeQuestion(this.l10n, 'outputLineContentMismatch', {
        line: mismatchReason.line,
        expected: mismatchReason.expectedValue,
        actual: mismatchReason.actualValue,
      });
    }

    return '';
  }

  setPassedCellStatus(cell, passed, mismatchReason = null) {
    if (!cell) return;

    const label = passed
      ? (this.l10n.testPassed || this.l10n.successText || 'Test passed')
      : (this.l10n.testFailed || this.l10n.failedText || 'Test failed');

    let reasonText = '';
    try {
      reasonText = passed ? '' : this.describeMismatchReason(mismatchReason);
    }
    catch {
      // Missing translation must never break rendering of the pass/fail mark.
      reasonText = '';
    }

    cell.replaceChildren();

    const mark = document.createElement('span');
    mark.className = 'testcase-passed-mark';
    mark.textContent = passed ? '✓' : '✗';
    cell.appendChild(mark);

    const fullLabel = reasonText ? `${label}: ${reasonText}` : label;

    if (reasonText) {
      const reasonEl = document.createElement('span');
      reasonEl.className = 'testcase-mismatch-reason';
      reasonEl.textContent = reasonText;
      cell.appendChild(reasonEl);
    }

    cell.setAttribute('aria-label', fullLabel);
    cell.title = fullLabel;
  }

  getDOM() {
    // Create a temporary container
    const testCasesArea = super.getDOM();
    const container = document.createElement('div');
    const headers = [
      this.l10n.testInput,
      this.l10n.expectedOutput,
      this.l10n.lastOutput,
      this.l10n.passed,
    ];


    if (this.enableDueDate && this.dueDate) {
      const dueDateHandler = new DateHandler(this.dueDate, this.l10n);
      container.appendChild(dueDateHandler.getDueDateMeta());
    }

    // Iterate over each test case
    this.session.testcases.forEach((testCase, i) => {
      // Test case container
      const testCaseDiv = document.createElement('div');
      testCaseDiv.className = 'table-testcase-container';

      // Heading
      const heading = document.createElement('h3');
      heading.textContent = `${this.l10n.testCase} ${i + 1}`;
      testCaseDiv.appendChild(heading);

      // Table
      const table = document.createElement('table');
      table.className = `table-testcase table-testcase-${i}`;

      // Table header
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headers.forEach((label) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = label;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Table body
      const tbody = document.createElement('tbody');
      const bodyRow = document.createElement('tr');

      // Input cell
      const inputCell = document.createElement('td');
      inputCell.className = `input input-${i}`;
      inputCell.dataset.label = headers[0];
      setMultilineText(inputCell, testCase.hidden
        ? [this.l10n.hidden]
        : testCase.inputs);
      bodyRow.appendChild(inputCell);

      // Expected output cell
      const expectedCell = document.createElement('td');
      expectedCell.className = `expected expected-${i}`;
      expectedCell.dataset.label = headers[1];
      setMultilineText(expectedCell, testCase.hidden
        ? [this.l10n.hidden]
        : testCase.outputs);
      bodyRow.appendChild(expectedCell);

      // Last output cell
      const outputCell = document.createElement('td');
      outputCell.className = `output output-${i}`;
      outputCell.dataset.label = headers[2];
      outputCell.setAttribute('aria-live', 'polite');
      bodyRow.appendChild(outputCell);

      // Passed cell
      const passedCell = document.createElement('td');
      passedCell.className = `passed passed-${i}`;
      passedCell.dataset.label = headers[3];
      passedCell.setAttribute('aria-live', 'polite');
      bodyRow.appendChild(passedCell);

      // Append row and table
      tbody.appendChild(bodyRow);
      table.appendChild(tbody);
      testCaseDiv.appendChild(table);

      // Append test case container to main container
      container.appendChild(testCaseDiv);
    });

    testCasesArea.replaceChildren(container);

    // Return the HTML string of the whole structure
    return testCasesArea;
  }
}

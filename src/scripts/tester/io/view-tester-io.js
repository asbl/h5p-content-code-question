import TestCaseView from '../components/view-tester';
import DateHandler from '@scripts/tester/components/date-handler';

// Spezifische Implementierung für IO Testcases
export class IOTesterView extends TestCaseView {
  constructor(l10n, session, dueDate, enableDueDate = false) {
    super();
    this.l10n = l10n;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
    this.session = session;
  }

  update(testCaseIndex, output, passed) {
    if (!this.getTestCasesAreaDiv()) return;
    const row = this.getTestCasesAreaDiv().querySelector(
      `.table-testcase-${testCaseIndex} tbody tr`,
    );
    if (!row) return;
    row.querySelector('.output').innerHTML = output.join('<br/>') || '--';
    row.classList.toggle('test-passed', passed);
    row.querySelector('.passed').textContent = passed ? '✓' : '✗';
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
      inputCell.innerHTML = testCase.hidden
        ? this.l10n.hidden
        : (testCase.inputs ?? []).join('<br/>');
      bodyRow.appendChild(inputCell);

      // Expected output cell
      const expectedCell = document.createElement('td');
      expectedCell.className = `expected expected-${i}`;
      expectedCell.dataset.label = headers[1];
      expectedCell.innerHTML = testCase.hidden
        ? this.l10n.hidden
        : (testCase.outputs ?? []).join('<br/>');
      bodyRow.appendChild(expectedCell);

      // Last output cell
      const outputCell = document.createElement('td');
      outputCell.className = `output output-${i}`;
      outputCell.dataset.label = headers[2];
      bodyRow.appendChild(outputCell);

      // Passed cell
      const passedCell = document.createElement('td');
      passedCell.className = `passed passed-${i}`;
      passedCell.dataset.label = headers[3];
      bodyRow.appendChild(passedCell);

      // Append row and table
      tbody.appendChild(bodyRow);
      table.appendChild(tbody);
      testCaseDiv.appendChild(table);

      // Append test case container to main container
      container.appendChild(testCaseDiv);
    });

    testCasesArea.innerHTML = container.innerHTML;

    // Return the HTML string of the whole structure
    return testCasesArea;
  }
}

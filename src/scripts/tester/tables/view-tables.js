import TestCaseView from '../components/view-tester';
import DateHandler from '@scripts/tester/components/date-handler';
import TablesComparator from '@scripts/tester/tables/comparator-tables';

/**
 * TablesView
 *
 * Displays table-based testcases side by side and highlights differences.
 */
export default class TablesView extends TestCaseView {
  constructor(l10n, session, targetTable) {
    super();
    this.l10n = l10n;
    this.session = session;
    this.targetTable = targetTable || [];
    this.resultTable = [];
    this.consoleID = `tables-console-${H5P.createUUID()}`;
    this.copyButtonID = `copy_${H5P.createUUID()}`;
  }

  setTargetTable(table) {
    this.targetTable = table;
  }

  setResultTable(table) {
    this.resultTable = table;
  }

  /**
   * Update the view and highlight differences.
   */
  update() {
    const comparator = new TablesComparator();
    const comparison = comparator.getComparisonDetails(this.targetTable, this.resultTable);
    const container = this.getTestCasesAreaDiv();
    if (!container) return;
    console.log("comparison", comparison);

    container.innerHTML = '';
    container.classList.remove('matching', 'not-matching');
    container.classList.add(comparison.identical ? 'matching' : 'not-matching');

    // Display due date if enabled
    if (this.enableDueDate && this.dueDate) {
      const dueDateHandler = new DateHandler(this.dueDate);
      container.appendChild(dueDateHandler.getDueDateDiv());
      container.appendChild(dueDateHandler.getDueDateBadge());
    }

    // Wrapper for columns + summary
    const wrapperDiv = document.createElement('div');
    wrapperDiv.classList.add('tables-tester-wrapper'); // CSS: flex-direction: column

    // Columns container
    const viewDiv = document.createElement('div');
    viewDiv.classList.add('tables-tester-area'); // CSS: display:flex; flex-direction: row

    // --- My Answer Column ---
    const outputCol = document.createElement('div');
    outputCol.classList.add('console-column');
    outputCol.innerHTML = `<h4> My Answer </h4>
      <pre class="tables-output">${this.formatTable(
    this.resultTable,
    comparison,
    'answer'
  )}</pre>`;

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.id = this.copyButtonID;
    copyBtn.textContent = this.l10n.copy || 'Copy';
    copyBtn.onclick = () =>
      navigator.clipboard.writeText(this.formatTable(this.resultTable, comparison, 'answer'))
        .then(() => alert(this.l10n.copySuccess || 'Copied!'));
    outputCol.appendChild(copyBtn);

    // --- Expected Column ---
    const expectedCol = document.createElement('div');
    expectedCol.classList.add('console-column');
    expectedCol.innerHTML = `<h4> Expected Answer </h4>
      <pre class="tables-expected">${this.formatTable(
    this.targetTable,
    comparison,
    'expected'
  )}</pre>`;

    viewDiv.appendChild(outputCol);
    viewDiv.appendChild(expectedCol);

    wrapperDiv.appendChild(viewDiv);
    container.appendChild(wrapperDiv);
  }

  /**
   * Format a table as HTML with highlights for differences.
   * @param {Array<object>} tableArray - table array
   * @param {object} comparison - comparison object from comparator
   * @param {'answer'|'expected'} side - which table we are formatting
   */
  formatTable(tableArray, comparison) {
    if (!tableArray || !tableArray[0]) {
      return '';
    }

    const table = tableArray[0];

    // Columns HTML
    const columnsHtml = (table.columns || []).map((col, cIndex) => {
      const isMatch = comparison?.colMatches?.[cIndex] ?? false; // safe access
      return `<th class="${isMatch ? 'matching' : 'not-matching'}">${col}</th>`;
    }).join('');

    // Rows HTML
    const rowsHtml = (table.values || []).map((row, rIndex) => {
      const rowClass = comparison?.rowMatches?.[rIndex] ? 'matching' : 'not-matching';
      const cellsHtml = row.map(cell => `<td>${cell}</td>`).join('');
      return `<tr class="${rowClass}">${cellsHtml}</tr>`;
    }).join('');

    // Assemble table HTML
    const html = `<table class="tables-table">
    <thead><tr>${columnsHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;

    return html;
  }
}
import TestCaseView from '../components/view-tester';
import DateHandler from '@scripts/tester/components/date-handler';
import TablesComparator from '@scripts/tester/tables/comparator-tables';
import {
  getCodeQuestionL10nValue,
  tCodeQuestion,
} from '@scripts/services/codequestion-l10n';

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

    container.innerHTML = '';
    container.classList.remove('matching', 'not-matching');
    container.classList.add(comparison.identical ? 'matching' : 'not-matching');

    // Display due date if enabled
    if (this.enableDueDate && this.dueDate) {
      const dueDateHandler = new DateHandler(this.dueDate, this.l10n);
      container.appendChild(dueDateHandler.getDueDateMeta());
    }

    // Wrapper for columns + summary
    const wrapperDiv = document.createElement('div');
    wrapperDiv.classList.add('tables-tester-wrapper'); // CSS: flex-direction: column

    const summary = document.createElement('div');
    summary.classList.add('tables-diff-summary');
    summary.innerHTML = this.renderSummary(comparison);

    // Columns container
    const viewDiv = document.createElement('div');
    viewDiv.classList.add('tables-tester-area'); // CSS: display:flex; flex-direction: row

    // --- My Answer Column ---
    const outputCol = document.createElement('div');
    outputCol.classList.add('console-column');
    outputCol.innerHTML = `<h4>${getCodeQuestionL10nValue(this.l10n, 'myAnswer')}</h4>
      <pre class="tables-output">${this.formatTable(
    this.resultTable,
    comparison,
    'answer'
  )}</pre>`;

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.id = this.copyButtonID;
    copyBtn.textContent = getCodeQuestionL10nValue(this.l10n, 'copy');
    const copyStatus = document.createElement('div');
    copyStatus.classList.add('copy-status');
    copyBtn.onclick = () =>
      navigator.clipboard.writeText(this.formatTable(this.resultTable, comparison))
        .then(() => {
          copyStatus.textContent = getCodeQuestionL10nValue(this.l10n, 'copySuccess');
        });
    outputCol.appendChild(copyBtn);
    outputCol.appendChild(copyStatus);

    // --- Expected Column ---
    const expectedCol = document.createElement('div');
    expectedCol.classList.add('console-column');
    expectedCol.innerHTML = `<h4>${getCodeQuestionL10nValue(this.l10n, 'expectedAnswer')}</h4>
      <pre class="tables-expected">${this.formatTable(
    this.targetTable,
    comparison
  )}</pre>`;

    viewDiv.appendChild(outputCol);
    viewDiv.appendChild(expectedCol);

    wrapperDiv.appendChild(summary);
    wrapperDiv.appendChild(viewDiv);
    container.appendChild(wrapperDiv);
  }

  renderSummary(comparison) {
    const statusKey = comparison.identical ? 'tableDiffSolved' : 'tableDiffNeedsFix';
    const details = [
      this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffRowSummary'),
        tCodeQuestion(this.l10n, 'tableDiffRowSummaryValue', {
          matching: comparison.matchingRows,
          missing: comparison.missingRows.length,
          extra: comparison.extraRows.length,
        }),
      ),
      this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffColumnSummary'),
        tCodeQuestion(this.l10n, 'tableDiffColumnSummaryValue', {
          matching: comparison.matchingCols,
          missing: comparison.missingColumns.length,
          extra: comparison.extraColumns.length,
        }),
      ),
    ];

    if (comparison.missingColumns.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffMissingColumns'),
        comparison.missingColumns.join(', '),
      ));
    }

    if (comparison.extraColumns.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffExtraColumns'),
        comparison.extraColumns.join(', '),
      ));
    }

    if (comparison.missingRows.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffMissingRows'),
        comparison.missingRows.map((row) => row.join(' | ')).join('<br>'),
      ));
    }

    if (comparison.extraRows.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffExtraRows'),
        comparison.extraRows.map((row) => row.join(' | ')).join('<br>'),
      ));
    }

    return `
      <div class="tables-diff-status ${comparison.identical ? 'matching' : 'not-matching'}">
        <strong>${getCodeQuestionL10nValue(this.l10n, statusKey)}</strong>
        <p>${getCodeQuestionL10nValue(this.l10n, 'tableDiffIntro')}</p>
      </div>
      <dl class="tables-diff-list">${details.join('')}</dl>
    `;
  }

  renderSummaryItem(label, value) {
    return `<div class="tables-diff-item"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  /**
   * Format a table as HTML with highlights for differences.
   * @param {Array<object>} tableArray - table array
   * @param {object} comparison - comparison object from comparator
   * @returns {string} Formatted HTML table.
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
      const cellsHtml = row.map((cell) => `<td>${cell}</td>`).join('');
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
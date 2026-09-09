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
    container.setAttribute('aria-live', 'polite');
    container.classList.remove('matching', 'not-matching');
    container.classList.add(comparison.identical ? 'matching' : 'not-matching');

    // Display due date if enabled
    if (this.enableDueDate && this.dueDate) {
      const dueDateHandler = new DateHandler(this.dueDate, this.l10n);
      container.appendChild(dueDateHandler.getDueDateMeta());
    }

    // Wrapper for tables and difference details
    const wrapperDiv = document.createElement('div');
    wrapperDiv.classList.add('tables-tester-wrapper'); // CSS: flex-direction: column

    // Columns container
    const viewDiv = document.createElement('div');
    viewDiv.classList.add('tables-tester-area'); // CSS: display:flex; flex-direction: row

    // --- My Answer Column ---
    const outputCol = document.createElement('div');
    outputCol.classList.add('console-column');
    outputCol.innerHTML = `<h4>${this.escapeHtml(getCodeQuestionL10nValue(this.l10n, 'myAnswer'))}</h4>
      ${this.renderInlineSummary(comparison)}
      <pre class="tables-output">${this.formatTable(
    this.resultTable,
    comparison,
    'answer'
  )}</pre>`;

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.id = this.copyButtonID;
    copyBtn.classList.add('copy-badge-button');
    copyBtn.textContent = getCodeQuestionL10nValue(this.l10n, 'copy');
    const copyStatus = document.createElement('div');
    copyStatus.classList.add('copy-status');
    copyStatus.setAttribute('role', 'status');
    copyStatus.setAttribute('aria-live', 'polite');
    copyBtn.onclick = () =>
      navigator.clipboard.writeText(this.formatTableText(this.resultTable))
        .then(() => {
          copyStatus.textContent = getCodeQuestionL10nValue(this.l10n, 'copySuccess');
        });
    outputCol.appendChild(copyBtn);
    outputCol.appendChild(copyStatus);

    // --- Expected Column ---
    const expectedCol = document.createElement('div');
    expectedCol.classList.add('console-column');
    expectedCol.innerHTML = `<h4>${this.escapeHtml(getCodeQuestionL10nValue(this.l10n, 'expectedAnswer'))}</h4>
      <pre class="tables-expected">${this.formatTable(
    this.targetTable,
    comparison
  )}</pre>`;

    viewDiv.appendChild(outputCol);
    viewDiv.appendChild(expectedCol);

    wrapperDiv.appendChild(viewDiv);

    const detailMarkup = this.renderDetailList(comparison);
    if (detailMarkup) {
      const detailSection = document.createElement('div');
      detailSection.classList.add('tables-diff-details');
      detailSection.innerHTML = detailMarkup;
      wrapperDiv.appendChild(detailSection);
    }

    container.appendChild(wrapperDiv);
  }

  renderInlineSummary(comparison) {
    const statusKey = comparison.identical ? 'tableDiffSolved' : 'tableDiffNeedsFix';
    const statusSymbol = comparison.identical ? '✓' : '✕';
    const rowSummary = tCodeQuestion(this.l10n, 'tableDiffRowSummaryValue', {
      matching: comparison.matchingRows,
      missing: comparison.missingRows.length,
      extra: comparison.extraRows.length,
    });
    const columnSummary = tCodeQuestion(this.l10n, 'tableDiffColumnSummaryValue', {
      matching: comparison.matchingCols,
      missing: comparison.missingColumns.length,
      extra: comparison.extraColumns.length,
    });

    return `
      <div class="tables-inline-summary">
        <p class="tables-inline-summary-status ${comparison.identical ? 'matching' : 'not-matching'}"><span class="tables-inline-status-icon" aria-hidden="true">${statusSymbol}</span><strong>${this.escapeHtml(getCodeQuestionL10nValue(this.l10n, statusKey))}</strong></p>
        <p>${this.escapeHtml(getCodeQuestionL10nValue(this.l10n, 'tableDiffRowSummary'))}: ${this.escapeHtml(rowSummary)}</p>
        <p>${this.escapeHtml(getCodeQuestionL10nValue(this.l10n, 'tableDiffColumnSummary'))}: ${this.escapeHtml(columnSummary)}</p>
      </div>
    `;
  }

  renderDetailList(comparison) {
    const details = [];

    if (comparison.missingColumns.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffMissingColumns'),
        this.escapeHtml(comparison.missingColumns.join(', ')),
      ));
    }

    if (comparison.extraColumns.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffExtraColumns'),
        this.escapeHtml(comparison.extraColumns.join(', ')),
      ));
    }

    if (comparison.missingRows.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffMissingRows'),
        comparison.missingRows.map((row) => this.escapeHtml(row.join(' | '))).join('<br>'),
      ));
    }

    if (comparison.extraRows.length > 0) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffExtraRows'),
        comparison.extraRows.map((row) => this.escapeHtml(row.join(' | '))).join('<br>'),
      ));
    }

    if (details.length === 0) {
      return '';
    }

    return `
      <p class="tables-diff-intro">${this.escapeHtml(getCodeQuestionL10nValue(this.l10n, 'tableDiffIntro'))}</p>
      <dl class="tables-diff-list">${details.join('')}</dl>
    `;
  }

  renderSummaryItem(label, value) {
    return `<div class="tables-diff-item"><dt>${this.escapeHtml(label)}</dt><dd>${value}</dd></div>`;
  }

  escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }

  getPrimaryTable(tableArray) {
    return tableArray?.[0] || null;
  }

  normalizeCellValue(value) {
    return String(value ?? '').trim();
  }

  serializeRow(row = []) {
    return row.map((value) => this.normalizeCellValue(value)).join('|');
  }

  getCounterpartTable(role) {
    return role === 'answer'
      ? this.getPrimaryTable(this.targetTable)
      : this.getPrimaryTable(this.resultTable);
  }

  rowExistsInCounterpart(row, role) {
    const serializedRow = this.serializeRow(row);
    const counterpartRows = this.getCounterpartTable(role)?.values || [];

    return counterpartRows.some((candidate) => this.serializeRow(candidate) === serializedRow);
  }

  getHeaderClass(isMatch) {
    return isMatch ? 'table-column-match' : 'table-column-mismatch';
  }

  getCellClass(role, row, rowIndex, columnIndex) {
    if (this.rowExistsInCounterpart(row, role)) {
      return '';
    }

    const counterpartRow = this.getCounterpartTable(role)?.values?.[rowIndex] || [];
    const currentValue = this.normalizeCellValue(row?.[columnIndex]);
    const counterpartValue = this.normalizeCellValue(counterpartRow?.[columnIndex]);

    return currentValue === counterpartValue ? '' : 'table-cell-mismatch';
  }

  getRowStatusSymbol(row, role) {
    return this.rowExistsInCounterpart(row, role) ? '✓' : '✕';
  }

  getRowStatusLabel(row, role) {
    return this.rowExistsInCounterpart(row, role)
      ? (this.l10n.tableRowMatches || 'Matching row')
      : (this.l10n.tableRowDiffers || 'Different row');
  }

  formatCellContent(cell, row, role, rowIndex, columnIndex) {
    const value = this.escapeHtml(cell);
    if (role !== 'answer' || columnIndex !== 0) {
      return `${value}`;
    }

    return `<span class="table-row-status-symbol" aria-hidden="true">${this.getRowStatusSymbol(row, role)}</span><span class="sr-only">${this.escapeHtml(this.getRowStatusLabel(row, role))}: </span><span class="table-cell-value">${value}</span>`;
  }

  /**
   * Format a table as HTML with highlights for differences.
   * @param {Array<object>} tableArray - table array
   * @param {object} comparison - comparison object from comparator
   * @param {string} [role='expected'] - Whether the table is the expected or learner answer.
   * @returns {string} Formatted HTML table.
   */
  formatTable(tableArray, comparison, role = 'expected') {
    if (!tableArray || !tableArray[0]) {
      return '';
    }

    const table = tableArray[0];

    // Columns HTML
    const columnsHtml = (table.columns || []).map((col, cIndex) => {
      const isMatch = comparison?.colMatches?.[cIndex] ?? false; // safe access
      return `<th scope="col" class="${this.getHeaderClass(isMatch)}">${this.escapeHtml(col)}</th>`;
    }).join('');

    // Rows HTML
    const rowsHtml = (table.values || []).map((row, rIndex) => {
      const rowClass = this.rowExistsInCounterpart(row, role) ? 'table-row-match' : 'table-row-mismatch';
      const cellsHtml = row.map((cell, cIndex) => {
        const cellClass = this.getCellClass(role, row, rIndex, cIndex);
        return `<td class="${cellClass}">${this.formatCellContent(cell, row, role, rIndex, cIndex)}</td>`;
      }).join('');
      return `<tr class="${rowClass}">${cellsHtml}</tr>`;
    }).join('');

    // Assemble table HTML
    const html = `<table class="tables-table">
    <thead><tr>${columnsHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;

    return html;
  }

  /**
   * Serializes a table for the clipboard without exposing presentation markup.
   * @param {Array<object>} tableArray - Table array.
   * @returns {string} Tab-separated text.
   */
  formatTableText(tableArray) {
    const table = this.getPrimaryTable(tableArray);
    if (!table) {
      return '';
    }

    return [table.columns || [], ...(table.values || [])]
      .map((row) => row.map((cell) => String(cell ?? '')).join('\t'))
      .join('\n');
  }
}

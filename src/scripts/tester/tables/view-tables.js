import TestCaseView from '../components/view-tester';
import DateHandler from '@scripts/tester/components/date-handler';
import TablesComparator from '@scripts/tester/tables/comparator-tables';
import {
  renderLearningGoals,
  testCaseTitle,
} from '../components/testcase-feedback';
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
  /**
   * @param {object} l10n Localized labels.
   * @param {object|null} session Test session (provides the authored test cases).
   * @param {Array} targetTable Expected result of the first test case.
   * @param {object} [extras] Optional dueDate, enableDueDate and comparisonOptions.
   */
  constructor(l10n, session, targetTable, extras = {}) {
    super();
    this.l10n = l10n;
    this.session = session;
    this.targetTable = targetTable || [];
    this.resultTable = [];
    this.dueDate = extras.dueDate || null;
    this.enableDueDate = extras.enableDueDate === true;
    this.comparisonOptions = extras.comparisonOptions || {};
    this.comparator = new TablesComparator();
    this.cases = new Map();
    this.currentIndex = 0;
    this.queryConstraintResult = null;
    this.activeComparison = null;
    this.initialTarget = targetTable || [];
    if (this.initialTarget.length) this.getCase(0).target = this.initialTarget;
    this.consoleID = `tables-console-${H5P.createUUID()}`;
    this.copyButtonID = `copy_${H5P.createUUID()}`;
  }

  getCase(index) {
    if (!this.cases.has(index)) {
      this.cases.set(index, {
        target: [], result: [], comparison: null, passed: null, reason: null,
      });
    }
    return this.cases.get(index);
  }

  setTargetTable(table, index = this.currentIndex) {
    this.currentIndex = index;
    this.getCase(index).target = table || [];
    if (index === 0) this.targetTable = table || [];
  }

  setResultTable(table, index = this.currentIndex) {
    this.currentIndex = index;
    this.getCase(index).result = table || [];
    if (index === 0) this.resultTable = table || [];
  }

  /**
   * Stores the structural query check result that is shown above the tests.
   * @param {{passed: boolean, violations: string[], checks?: object[]}|null} result Check result.
   */
  setQueryConstraintResult(result) {
    this.queryConstraintResult = result || null;
  }

  resetDOM() {
    this.cases = new Map();
    this.currentIndex = 0;
    this.queryConstraintResult = null;
    this.targetTable = this.initialTarget;
    this.resultTable = [];
    if (this.initialTarget.length) this.getCase(0).target = this.initialTarget;
    super.resetDOM();
  }

  /**
   * Returns the authored test cases, if there is more than the implicit one.
   * @returns {object[]} Test cases.
   */
  getTestCases() {
    return Array.isArray(this.session?.testcases) ? this.session.testcases : [];
  }

  /**
   * Update the view and highlight differences.
   * @param {number} [index] Index of the evaluated test case.
   * @param {Array} [_output] Unused learner output (tables are stored separately).
   * @param {boolean|undefined} [passed] Whether the case passed overall.
   * @param {object|null} [reason] Why the case failed.
   */
  update(index = this.currentIndex, _output, passed, reason = null) {
    const container = this.getTestCasesAreaDiv();
    if (!container) return;

    this.currentIndex = index;
    const current = this.getCase(index);
    current.comparison = this.comparator.getComparisonDetails(
      current.target,
      current.result,
      this.comparisonOptions,
    );
    current.passed = typeof passed === 'boolean' ? passed : current.comparison.identical;
    current.reason = reason;

    container.innerHTML = '';
    container.setAttribute('aria-live', 'polite');
    container.classList.remove('matching', 'not-matching');

    const testCases = this.getTestCases();
    const evaluated = [...this.cases.values()].filter((entry) => entry.comparison);
    const allPassed = evaluated.length > 0
      && evaluated.every((entry) => entry.passed)
      && evaluated.length === Math.max(testCases.length, 1);
    container.classList.add(allPassed || (testCases.length <= 1 && current.passed) ? 'matching' : 'not-matching');

    // Display due date if enabled
    if (this.enableDueDate && this.dueDate) {
      const dueDateHandler = new DateHandler(this.dueDate, this.l10n);
      container.appendChild(dueDateHandler.getDueDateMeta());
    }

    this.renderQueryConstraints(container);

    if (testCases.length <= 1) {
      container.appendChild(this.renderComparison(current));
      return;
    }

    const list = document.createElement('div');
    list.classList.add('tables-testcases');
    testCases.forEach((testCase, caseIndex) => {
      const entry = this.cases.get(caseIndex);
      if (!entry?.comparison) return;
      list.appendChild(this.renderTestCase(testCase, caseIndex, entry));
    });
    container.appendChild(list);
  }

  updateLearningGoals(results) {
    renderLearningGoals(this, results);
  }

  /**
   * Renders the structural query requirements and their outcome.
   * @param {HTMLElement} container Target container.
   */
  renderQueryConstraints(container) {
    const result = this.queryConstraintResult;
    if (!result || !Array.isArray(result.checks) || result.checks.length === 0) return;

    const section = document.createElement('section');
    section.classList.add('tables-query-constraints', result.passed ? 'matching' : 'not-matching');
    const heading = document.createElement('h4');
    heading.textContent = getCodeQuestionL10nValue(this.l10n, 'queryConstraintsTitle');
    const list = document.createElement('ul');
    result.checks.forEach((check) => {
      const item = document.createElement('li');
      item.classList.add(check.passed ? 'matching' : 'not-matching');
      item.textContent = `${check.passed ? '✓' : '✕'} ${check.message}`;
      list.appendChild(item);
    });
    section.append(heading, list);
    container.appendChild(section);
  }

  /**
   * Renders one test case of a multi-case check.
   * @param {object} testCase Authored test case.
   * @param {number} index Zero-based index.
   * @param {object} entry Stored tables and comparison for the case.
   * @returns {HTMLElement} Rendered case.
   */
  renderTestCase(testCase, index, entry) {
    const hidden = testCase?.hidden === true;
    const details = document.createElement('details');
    details.classList.add('tables-testcase', entry.passed ? 'matching' : 'not-matching');
    details.open = !entry.passed && !hidden;

    const summary = document.createElement('summary');
    const statusLabel = getCodeQuestionL10nValue(
      this.l10n,
      entry.passed ? 'testResultPassed' : 'testResultFailed',
    );
    const symbol = document.createElement('span');
    symbol.classList.add('table-row-status-symbol');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = entry.passed ? '✓' : '✕';
    const srStatus = document.createElement('span');
    srStatus.classList.add('sr-only');
    srStatus.textContent = `${statusLabel}: `;
    summary.append(symbol, srStatus, document.createTextNode(testCaseTitle(this.l10n, testCase || {}, index)));
    details.appendChild(summary);

    if (!entry.passed && !hidden && testCase?.failureHint) {
      const hint = document.createElement('p');
      hint.classList.add('testcase-hint');
      hint.setAttribute('aria-live', 'polite');
      hint.textContent = tCodeQuestion(this.l10n, 'testCaseHint', { hint: testCase.failureHint });
      details.appendChild(hint);
    }

    if (hidden) {
      const note = document.createElement('p');
      note.textContent = `${this.l10n.hidden || '[hidden]'} — ${statusLabel}`;
      details.appendChild(note);
      return details;
    }

    if (testCase?.setupSql) {
      // Make the data variant understandable without disclosing the solution.
      details.dataset.hasSetup = 'true';
    }

    details.appendChild(this.renderComparison(entry));
    return details;
  }

  /**
   * Renders the side-by-side tables and the difference list of one case.
   * @param {object} entry Stored tables and comparison for the case.
   * @returns {HTMLElement} Rendered comparison.
   */
  renderComparison(entry) {
    const previous = {
      target: this.targetTable,
      result: this.resultTable,
      comparison: this.activeComparison,
    };
    this.targetTable = entry.target;
    this.resultTable = entry.result;
    this.activeComparison = entry.comparison;
    const comparison = entry.comparison;

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
    copyBtn.id = `${this.copyButtonID}_${this.currentIndex}`;
    copyBtn.classList.add('copy-badge-button');
    copyBtn.textContent = getCodeQuestionL10nValue(this.l10n, 'copy');
    const copyStatus = document.createElement('div');
    copyStatus.classList.add('copy-status');
    copyStatus.setAttribute('role', 'status');
    copyStatus.setAttribute('aria-live', 'polite');
    const copyTable = this.resultTable;
    copyBtn.onclick = () =>
      navigator.clipboard.writeText(this.formatTableText(copyTable))
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

    this.targetTable = previous.target;
    this.resultTable = previous.result;
    this.activeComparison = previous.comparison;
    return wrapperDiv;
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

    if (comparison.rowOrderMismatch) {
      details.push(this.renderSummaryItem(
        getCodeQuestionL10nValue(this.l10n, 'tableDiffRowOrder'),
        '',
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

  /**
   * Tells whether a row has a counterpart in the other table. While a case is
   * rendered, the comparison result is authoritative so that author options
   * (case, tolerance, ...) are respected in the highlighting.
   * @param {Array} row Row values.
   * @param {string} role 'answer' or 'expected'.
   * @param {number} [rowIndex] Index of the row in its own table.
   * @returns {boolean} True if the row is matched.
   */
  rowExistsInCounterpart(row, role, rowIndex = -1) {
    const flags = role === 'answer'
      ? this.activeComparison?.actualRowMatches
      : this.activeComparison?.rowMatches;
    if (Array.isArray(flags) && rowIndex >= 0 && rowIndex < flags.length) {
      return flags[rowIndex] === true;
    }

    const serializedRow = this.serializeRow(row);
    const counterpartRows = this.getCounterpartTable(role)?.values || [];

    return counterpartRows.some((candidate) => this.serializeRow(candidate) === serializedRow);
  }

  getHeaderClass(isMatch) {
    return isMatch ? 'table-column-match' : 'table-column-mismatch';
  }

  getCellClass(role, row, rowIndex, columnIndex) {
    if (this.rowExistsInCounterpart(row, role, rowIndex)) {
      return '';
    }

    const counterpartRow = this.getCounterpartTable(role)?.values?.[rowIndex] || [];
    const currentValue = this.normalizeCellValue(row?.[columnIndex]);
    const counterpartValue = this.normalizeCellValue(counterpartRow?.[columnIndex]);

    return currentValue === counterpartValue ? '' : 'table-cell-mismatch';
  }

  getRowStatusSymbol(row, role, rowIndex = -1) {
    return this.rowExistsInCounterpart(row, role, rowIndex) ? '✓' : '✕';
  }

  getRowStatusLabel(row, role, rowIndex = -1) {
    return this.rowExistsInCounterpart(row, role, rowIndex)
      ? (this.l10n.tableRowMatches || 'Matching row')
      : (this.l10n.tableRowDiffers || 'Different row');
  }

  formatCellContent(cell, row, role, rowIndex, columnIndex) {
    const value = this.escapeHtml(cell);
    if (role !== 'answer' || columnIndex !== 0) {
      return `${value}`;
    }

    return `<span class="table-row-status-symbol" aria-hidden="true">${this.getRowStatusSymbol(row, role, rowIndex)}</span><span class="sr-only">${this.escapeHtml(this.getRowStatusLabel(row, role, rowIndex))}: </span><span class="table-cell-value">${value}</span>`;
  }

  /**
   * Format a table as HTML with highlights for differences.
   * @param {Array<object>} tableArray - table array
   * @param {object} comparison - comparison object from comparator
   * @param {string} [role] - Whether the table is the expected or learner answer.
   * @returns {string} Formatted HTML table.
   */
  formatTable(tableArray, comparison, role = 'expected') {
    if (!tableArray || !tableArray[0]) {
      return '';
    }

    const table = tableArray[0];

    // Columns HTML
    const columnFlags = role === 'answer' && Array.isArray(comparison?.actualColMatches)
      ? comparison.actualColMatches
      : comparison?.colMatches;
    const columnsHtml = (table.columns || []).map((col, cIndex) => {
      const isMatch = columnFlags?.[cIndex] ?? false; // safe access
      return `<th scope="col" class="${this.getHeaderClass(isMatch)}">${this.escapeHtml(col)}</th>`;
    }).join('');

    // Rows HTML
    const rowsHtml = (table.values || []).map((row, rIndex) => {
      const rowClass = this.rowExistsInCounterpart(row, role, rIndex) ? 'table-row-match' : 'table-row-mismatch';
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

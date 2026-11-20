const COLUMN_COMPARISON_MODES = ['exact', 'ignoreOrder', 'ignoreNames'];
const ROW_ORDER_MODES = ['ignore', 'strict'];

/**
 * Normalizes author-configured comparison options.
 *
 * Defaults reproduce the historic behavior: rows are compared as a multiset
 * (their order does not matter) while column names and positions must match.
 * @param {object} [options] Raw options from the content parameters.
 * @returns {{rowOrder: string, columnComparison: string, ignoreCase: boolean, numericTolerance: number}}
 *   Sanitized options.
 */
export function normalizeComparisonOptions(options = {}) {
  const source = options && typeof options === 'object' ? options : {};
  const tolerance = Number(source.numericTolerance);

  return {
    rowOrder: ROW_ORDER_MODES.includes(source.rowOrder) ? source.rowOrder : 'ignore',
    columnComparison: COLUMN_COMPARISON_MODES.includes(source.columnComparison)
      ? source.columnComparison
      : 'exact',
    ignoreCase: source.ignoreCase === true,
    numericTolerance: Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0,
  };
}

/**
 * Converts a cell value to the text used for comparison.
 * @param {*} value Cell value.
 * @returns {string} Trimmed text.
 */
function cellText(value) {
  return String(value).trim();
}

/**
 * Returns a finite number for numeric-looking text, otherwise null.
 * @param {string} text Normalized cell text.
 * @returns {number|null} Parsed number.
 */
function toNumber(text) {
  if (text === '' || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) {
    return null;
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export default class TablesComparator {
  /**
   * Compares two Tables
   * @param {Array} expected - Expected table
   * @param {Array} actual - Actual table
   * @returns {boolean} True, if tables are identical
   */
  compare(expected, actual) {
    if (!expected && !actual) return true;
    if (!expected || !actual) return false;
    if (expected.length !== actual.length) return false;

    for (let i = 0; i < expected.length; i++) {
      const exp = expected[i];
      const act = actual[i];

      // compare columns
      if (exp.columns.length !== act.columns.length) return false;
      for (let c = 0; c < exp.columns.length; c++) {
        if (exp.columns[c] !== act.columns[c]) return false;
      }

      // compare values
      if (exp.values.length !== act.values.length) return false;

      for (let r = 0; r < exp.values.length; r++) {
        if (exp.values[r].length !== act.values[r].length) return false;

        for (let c = 0; c < exp.values[r].length; c++) {
          if (
            String(exp.values[r][c]).trim() !==
            String(act.values[r][c]).trim()
          ) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Provides detailed comparison information for two tables.
   * Unlike the boolean compare() method, this method returns row and column
   * matching information, counters, and solved status.
   *
   * Assumptions:
   * - actual and expected are single tables (first element of array is used)
   * - Table structure:
   *   {
   *     columns: Array<string>,
   *     values: Array<Array<any>>
   *   }
   * - sql.js returns no table at all for an empty result; two empty results
   *   are therefore treated as identical.
   * @param {Array} expected Expected result tables.
   * @param {Array} actual Learner result tables.
   * @param {object} [options] Comparison options, see {@link normalizeComparisonOptions}.
   * @returns {object} Comparison details.
   *  @typedef {object} TableComparisonResult
   *  @property {boolean} identical - True if tables are fully identical.
   *  @property {boolean[]} rowMatches - Per expected row: has an equal learner row.
   *  @property {boolean[]} actualRowMatches - Per learner row: has an equal expected row.
   *  @property {boolean[]} colMatches - Per expected column match status.
   *  @property {boolean[]} actualColMatches - Per learner column match status.
   *  @property {number} matchingRows - Number of matching rows.
   *  @property {number} nonMatchingRows - Number of non-matching rows.
   *  @property {number} matchingCols - Number of matching columns.
   *  @property {number} nonMatchingCols - Number of non-matching columns.
   *  @property {boolean} rowOrderMismatch - Same rows, but in a different order
   *    although the order is required.
   *  @property {boolean} solved - True if all rows and columns match.
   */
  getComparisonDetails(expected, actual, options = {}) {
    const settings = normalizeComparisonOptions(options);
    const result = {
      identical: false,
      rowMatches: [],
      actualRowMatches: [],
      colMatches: [],
      actualColMatches: [],
      matchingRows: 0,
      nonMatchingRows: 0,
      matchingCols: 0,
      nonMatchingCols: 0,
      missingRows: [],
      extraRows: [],
      missingColumns: [],
      extraColumns: [],
      rowOrderMismatch: false,
      solved: false,
    };

    const hasExpected = Boolean(expected && expected[0]);
    const hasActual = Boolean(actual && actual[0]);

    if (!hasExpected && !hasActual) {
      result.identical = true;
      result.solved = true;
      return result;
    }

    if (!hasExpected || !hasActual) {
      return result;
    }

    const expTable = expected[0];
    const actTable = actual[0];
    const expColumns = expTable.columns || [];
    const actColumns = actTable.columns || [];

    const columnResult = this.compareColumns(expColumns, actColumns, settings);
    Object.assign(result, {
      colMatches: columnResult.colMatches,
      actualColMatches: columnResult.actualColMatches,
      matchingCols: columnResult.colMatches.filter(Boolean).length,
      nonMatchingCols: columnResult.colMatches.length - columnResult.colMatches.filter(Boolean).length,
      missingColumns: columnResult.missingColumns,
      extraColumns: columnResult.extraColumns,
    });

    // --- Rows ---
    const expectedRows = (expTable.values || []).map((row) => row.map((value) => this.normalizeCell(value, settings)));
    const actualRows = (actTable.values || []).map((row) => {
      const ordered = columnResult.permutation
        ? columnResult.permutation.map((index) => row[index])
        : row;
      return ordered.map((value) => this.normalizeCell(value, settings));
    });

    const matching = this.matchRows(expectedRows, actualRows, settings);
    result.rowMatches = matching.expectedMatches;
    result.actualRowMatches = matching.actualMatches;
    result.matchingRows = matching.expectedMatches.filter(Boolean).length;
    result.nonMatchingRows = matching.expectedMatches.filter((match) => !match).length;
    result.missingRows = (expTable.values || []).filter((_, index) => !matching.expectedMatches[index]);
    result.extraRows = (actTable.values || []).filter((_, index) => !matching.actualMatches[index]);

    const sameRowCount = expectedRows.length === actualRows.length;
    const sameColCount = expColumns.length === actColumns.length;

    if (
      settings.rowOrder === 'strict'
      && sameRowCount
      && result.nonMatchingRows === 0
      && result.extraRows.length === 0
    ) {
      result.rowOrderMismatch = !expectedRows.every(
        (row, index) => this.rowsEqual(row, actualRows[index], settings),
      );
    }

    // --- Identical: same number of rows & columns + all rows match + columns match ---
    result.identical = sameRowCount
      && sameColCount
      && result.nonMatchingRows === 0
      && result.extraRows.length === 0
      && result.nonMatchingCols === 0
      && !result.rowOrderMismatch;
    result.solved = result.identical;

    return result;
  }

  /**
   * Compares column headers according to the configured mode.
   * @param {string[]} expColumns Expected column names.
   * @param {string[]} actColumns Learner column names.
   * @param {object} settings Normalized options.
   * @returns {object} Column match info and, when columns may be reordered,
   *   the permutation that aligns learner columns with expected columns.
   */
  compareColumns(expColumns, actColumns, settings) {
    const sameName = (left, right) => (settings.ignoreCase
      ? String(left).toLowerCase() === String(right).toLowerCase()
      : left === right);
    const colCount = Math.max(expColumns.length, actColumns.length);

    if (settings.columnComparison === 'ignoreNames') {
      const matches = Array.from({ length: colCount }, (_, index) => (
        index < expColumns.length && index < actColumns.length
      ));
      return {
        colMatches: matches,
        actualColMatches: matches.slice(),
        missingColumns: [],
        extraColumns: [],
        permutation: null,
      };
    }

    if (settings.columnComparison === 'ignoreOrder') {
      const used = new Set();
      const permutation = [];
      const colMatches = expColumns.map((name) => {
        const index = actColumns.findIndex((candidate, position) => (
          !used.has(position) && sameName(name, candidate)
        ));
        if (index === -1) return false;
        used.add(index);
        permutation.push(index);
        return true;
      });
      const complete = colMatches.every(Boolean) && expColumns.length === actColumns.length;

      return {
        colMatches,
        actualColMatches: actColumns.map((_, position) => used.has(position)),
        missingColumns: expColumns.filter((_, index) => !colMatches[index]),
        extraColumns: actColumns.filter((_, position) => !used.has(position)),
        permutation: complete ? permutation : null,
      };
    }

    const colMatches = [];
    for (let c = 0; c < colCount; c++) {
      const expCol = expColumns[c] ?? null;
      const actCol = actColumns[c] ?? null;
      colMatches[c] = expCol !== null && actCol !== null && sameName(expCol, actCol);
    }

    return {
      colMatches,
      actualColMatches: colMatches.slice(),
      missingColumns: expColumns.filter((column) => !actColumns.includes(column)),
      extraColumns: actColumns.filter((column) => !expColumns.includes(column)),
      permutation: null,
    };
  }

  /**
   * Normalizes a cell for comparison.
   * @param {*} value Raw cell value.
   * @param {object} settings Normalized options.
   * @returns {string} Comparable text.
   */
  normalizeCell(value, settings) {
    const text = cellText(value);
    return settings.ignoreCase ? text.toLowerCase() : text;
  }

  /**
   * Compares two normalized cells, with optional numeric tolerance.
   * @param {string} left Expected cell text.
   * @param {string} right Learner cell text.
   * @param {object} settings Normalized options.
   * @returns {boolean} True if the cells are equal.
   */
  cellsEqual(left, right, settings) {
    if (left === right) return true;
    if (!settings.numericTolerance) return false;

    const leftNumber = toNumber(left);
    const rightNumber = toNumber(right);
    return leftNumber !== null
      && rightNumber !== null
      && Math.abs(leftNumber - rightNumber) <= settings.numericTolerance;
  }

  /**
   * Compares two normalized rows cell by cell.
   * @param {string[]} left Expected row.
   * @param {string[]} right Learner row.
   * @param {object} settings Normalized options.
   * @returns {boolean} True if the rows are equal.
   */
  rowsEqual(left, right, settings) {
    return left.length === right.length
      && left.every((cell, index) => this.cellsEqual(cell, right[index], settings));
  }

  /**
   * Matches expected rows with learner rows as a multiset, so that every
   * learner row can satisfy only one expected row. Equal rows are matched by
   * hash first; a numeric tolerance only compares the remaining rows.
   * @param {string[][]} expectedRows Normalized expected rows.
   * @param {string[][]} actualRows Normalized learner rows.
   * @param {object} settings Normalized options.
   * @returns {{expectedMatches: boolean[], actualMatches: boolean[]}} Per-row match flags.
   */
  matchRows(expectedRows, actualRows, settings) {
    const expectedMatches = expectedRows.map(() => false);
    const actualMatches = actualRows.map(() => false);

    // Exact pass: hash-based, so large results stay linear.
    const available = new Map();
    actualRows.forEach((row, index) => {
      const key = JSON.stringify(row);
      if (!available.has(key)) available.set(key, []);
      available.get(key).push(index);
    });

    expectedRows.forEach((row, index) => {
      const candidates = available.get(JSON.stringify(row));
      if (candidates && candidates.length) {
        expectedMatches[index] = true;
        actualMatches[candidates.shift()] = true;
      }
    });

    if (!settings.numericTolerance) {
      return { expectedMatches, actualMatches };
    }

    // Tolerance pass: only the rows left over are compared pairwise.
    expectedRows.forEach((row, index) => {
      if (expectedMatches[index]) return;
      const candidate = actualRows.findIndex((other, position) => (
        !actualMatches[position] && this.rowsEqual(row, other, settings)
      ));
      if (candidate !== -1) {
        expectedMatches[index] = true;
        actualMatches[candidate] = true;
      }
    });

    return { expectedMatches, actualMatches };
  }
}

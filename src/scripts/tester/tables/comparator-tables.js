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
   * Unlike {@link compare}, this method returns row and column
   * matching information, counters, and solved status.
   *
   * Assumptions:
   * - actual and expected are single tables (first element of array is used)
   * - Table structure:
   *   {
   *     columns: Array<string>,
   *     values: Array<Array<any>>
   *   }
   *  @typedef {Object} TableComparisonResult
   *  @property {boolean} identical - True if tables are fully identical.
   *  @property {boolean[]} rowMatches - Per-row match status.
   *  @property {boolean[]} colMatches - Per-column match status.
   *  @property {number} matchingRows - Number of matching rows.
   *  @property {number} nonMatchingRows - Number of non-matching rows.
   *  @property {number} matchingCols - Number of matching columns.
   *  @property {number} nonMatchingCols - Number of non-matching columns.
   *  @property {boolean} solved - True if all rows and columns match.
   */
  getComparisonDetails(expected, actual) {
    const result = {
      identical: false,
      rowMatches: [],
      colMatches: [],
      matchingRows: 0,
      nonMatchingRows: 0,
      matchingCols: 0,
      nonMatchingCols: 0,
      missingRows: [],
      extraRows: [],
      missingColumns: [],
      extraColumns: [],
      solved: false,
    };

    if (!expected || !expected[0] || !actual || !actual[0]) {
      return result;
    }

    const expTable = expected[0];
    const actTable = actual[0];

    // --- Columns ---
    const colCount = Math.max(expTable.columns?.length || 0, actTable.columns?.length || 0);
    result.colMatches = [];
    for (let c = 0; c < colCount; c++) {
      const expCol = expTable.columns?.[c] ?? null;
      const actCol = actTable.columns?.[c] ?? null;
      result.colMatches[c] = expCol === actCol;
    }
    result.matchingCols = result.colMatches.filter(Boolean).length;
    result.nonMatchingCols = colCount - result.matchingCols;
    result.missingColumns = (expTable.columns || []).filter((column) => !(actTable.columns || []).includes(column));
    result.extraColumns = (actTable.columns || []).filter((column) => !(expTable.columns || []).includes(column));

    // --- Rows ---
    const expectedRows = (expTable.values || []).map(r => r.map(v => String(v).trim()).join('|'));
    const actualRows = (actTable.values || []).map(r => r.map(v => String(v).trim()).join('|'));

    result.rowMatches = expectedRows.map(row => actualRows.includes(row));
    result.matchingRows = result.rowMatches.filter(Boolean).length;
    result.nonMatchingRows = result.rowMatches.filter(m => !m).length;
    result.missingRows = (expTable.values || []).filter((row) => {
      const serialized = row.map((value) => String(value).trim()).join('|');
      return !actualRows.includes(serialized);
    });
    result.extraRows = (actTable.values || []).filter((row) => {
      const serialized = row.map((value) => String(value).trim()).join('|');
      return !expectedRows.includes(serialized);
    });
    
    // --- Identical: same number of rows & columns + all rows match + columns match ---
    const sameRowCount = (expTable.values?.length || 0) === (actTable.values?.length || 0);
    const sameColCount = (expTable.columns?.length || 0) === (actTable.columns?.length || 0);
    result.identical = sameRowCount && sameColCount && result.nonMatchingRows === 0 && result.nonMatchingCols === 0;
    result.solved = result.identical;

    return result;
  }

}

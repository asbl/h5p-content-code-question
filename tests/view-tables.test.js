import { describe, expect, it } from 'vitest';

import ViewTables from '../src/scripts/tester/tables/view-tables';

describe('ViewTables', () => {
  it('renders a summary of row and column differences', () => {
    document.body.innerHTML = '<div id="fixture"></div>';

    const view = new ViewTables({}, null, [{
        columns: ['name', 'population'],
        values: [['Berlin', 1], ['Paris', 2]],
      }]);
    view.setResultTable([{
        columns: ['name', 'country'],
        values: [['Berlin', 1], ['Rome', 3]],
      }]);

    const fixture = document.getElementById('fixture');
    fixture.appendChild(view.getDOM());
    view.update();

    const summary = fixture.querySelector('.tables-inline-summary');
    const detailList = fixture.querySelector('.tables-diff-details');
    const tables = fixture.querySelectorAll('.tables-table');
    expect(summary?.textContent).toContain('Your query still needs adjustments.');
    expect(summary?.textContent).toContain('Rows');
    expect(summary?.textContent).toContain('Columns');
    expect(detailList?.innerHTML).toContain('Paris | 2');
    expect(detailList?.innerHTML).toContain('country');
    expect(fixture.querySelector('.tables-diff-summary')).toBeNull();
    expect(tables[0]?.innerHTML).toContain('table-column-mismatch');
    expect(tables[0]?.innerHTML).toContain('table-cell-mismatch');
  });
});
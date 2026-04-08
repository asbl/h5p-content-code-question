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

    const summary = fixture.querySelector('.tables-diff-summary');
    expect(summary?.textContent).toContain('Your query still needs adjustments.');
    expect(summary?.textContent).toContain('Rows');
    expect(summary?.textContent).toContain('Columns');
    expect(summary?.innerHTML).toContain('Paris | 2');
    expect(summary?.innerHTML).toContain('country');
  });
});
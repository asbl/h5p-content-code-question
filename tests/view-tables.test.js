import { describe, expect, it, vi } from 'vitest';

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
    const statusLine = fixture.querySelector('.tables-inline-summary-status');
    const detailList = fixture.querySelector('.tables-diff-details');
    const tables = fixture.querySelectorAll('.tables-table');
    const resultRows = tables[0]?.querySelectorAll('tbody tr') || [];
    expect(summary?.textContent).toContain('Your query still needs adjustments.');
    expect(statusLine?.textContent).toContain('✕');
    expect(summary?.textContent).toContain('Rows');
    expect(summary?.textContent).toContain('Columns');
    expect(detailList?.querySelector('.tables-diff-rows')?.textContent).toContain('Paris');
    expect(detailList?.querySelector('.tables-diff-cause')?.textContent).toContain('country');
    expect(detailList?.textContent).toContain('Fix the columns first');
    expect(fixture.querySelector('.tables-diff-summary')).toBeNull();
    expect(tables[0]?.innerHTML).toContain('table-column-mismatch');
    expect(tables[0]?.innerHTML).toContain('table-cell-mismatch');
    expect(resultRows[0]?.innerHTML).toContain('table-row-status-symbol');
    expect(resultRows[0]?.className).toContain('table-row-match');
    expect(resultRows[1]?.className).toContain('table-row-mismatch');
  });

  it('names the column mismatch before the row differences', () => {
    document.body.innerHTML = '<div id="fixture"></div>';

    const view = new ViewTables({}, null, [{ columns: ['name'], values: [['Berlin']] }]);
    view.setResultTable([{ columns: ['name', 'country'], values: [['Berlin', 'DE']] }]);

    const fixture = document.getElementById('fixture');
    fixture.appendChild(view.getDOM());
    view.update();

    const items = fixture.querySelectorAll('.tables-diff-item');
    expect(items[0].classList.contains('tables-diff-cause')).toBe(true);
    expect(items[0].textContent).toContain('Expected:');
    expect(items[0].textContent).toContain('Your query returns:');
    expect(items[0].querySelector('.is-different')?.textContent).toBe('country');
  });

  it('limits the listed differing rows', () => {
    document.body.innerHTML = '<div id="fixture"></div>';
    const view = new ViewTables({}, null, [{ columns: ['id'], values: [] }]);
    view.setResultTable([{ columns: ['id'], values: Array.from({ length: 25 }, (_, index) => [index]) }]);

    const fixture = document.getElementById('fixture');
    fixture.appendChild(view.getDOM());
    view.update();

    expect(fixture.querySelectorAll('.tables-diff-rows tbody tr')).toHaveLength(10);
    expect(fixture.querySelector('.tables-diff-more').textContent).toContain('15 more rows');
  });

  it('renders a check mark when the result matches the expected table', () => {
    document.body.innerHTML = '<div id="fixture"></div>';

    const view = new ViewTables({}, null, [{
      columns: ['name'],
      values: [['Berlin']],
    }]);
    view.setResultTable([{ 
      columns: ['name'],
      values: [['Berlin']],
    }]);

    const fixture = document.getElementById('fixture');
    fixture.appendChild(view.getDOM());
    view.update();

    const statusLine = fixture.querySelector('.tables-inline-summary-status');
    const firstRow = fixture.querySelector('.tables-table tbody tr');

    expect(statusLine?.textContent).toContain('✓');
    expect(firstRow?.className).toContain('table-row-match');
    expect(firstRow?.innerHTML).toContain('table-row-status-symbol');
  });

  it('renders table values as text and copies plain table data', async () => {
    document.body.innerHTML = '<div id="fixture"></div>';
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });

    const view = new ViewTables({}, null, [{
      columns: ['<img class="injected-column" src=x>'],
      values: [['<img class="injected-expected" src=x>']],
    }]);
    view.setResultTable([{
      columns: ['<img class="injected-result-column" src=x>'],
      values: [['<img class="injected-result" src=x>']],
    }]);

    document.getElementById('fixture').appendChild(view.getDOM());
    view.update();

    expect(document.querySelector('[class^="injected-"]')).toBeNull();
    expect(document.querySelector('.tables-output')?.textContent).toContain('<img class="injected-result" src=x>');

    document.querySelector('.copy-badge-button').click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(
      '<img class="injected-result-column" src=x>\n<img class="injected-result" src=x>',
    );
  });
});

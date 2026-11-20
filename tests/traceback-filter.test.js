import { describe, expect, it } from 'vitest';

import { filterLearnerTraceback } from '../src/scripts/services/traceback-filter.js';

describe('filterLearnerTraceback', () => {
  it('keeps only learner frames and the exception lines', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python313.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '    await CodeRunner(',
      '    ...<9 lines>...',
      '  File "<exec>", line 456, in _h5p_run_with_async_input',
      '  File "<h5p-learner-code>", line 1, in <module>',
      'NameError: name \'prin\' is not defined. Did you mean: \'print\'?',
      'Hint: Check the spelling.',
    ].join('\n');

    expect(filterLearnerTraceback(raw)).toBe([
      'Traceback (most recent call last):',
      '  File "<h5p-learner-code>", line 1, in <module>',
      'NameError: name \'prin\' is not defined. Did you mean: \'print\'?',
      'Hint: Check the spelling.',
    ].join('\n'));
  });

  it('drops runtime frames when the learner code is run as <exec>', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python313.zip/_pyodide/_base.py", line 413, in run',
      '  File "<exec>", line 3, in <module>',
      '    x = 1 / 0',
      'ZeroDivisionError: division by zero',
    ].join('\n');

    expect(filterLearnerTraceback(raw)).toBe([
      'Traceback (most recent call last):',
      '  File "<exec>", line 3, in <module>',
      '    x = 1 / 0',
      'ZeroDivisionError: division by zero',
    ].join('\n'));
  });

  it('leaves messages without a traceback unchanged', () => {
    expect(filterLearnerTraceback('line 15: boom')).toBe('line 15: boom');
    expect(filterLearnerTraceback('')).toBe('');
  });

  it('falls back to the original text when no frame would remain', () => {
    const raw = 'Traceback:\n  File "/lib/python313.zip/_pyodide/_base.py", line 1, in x\nError: y';

    expect(filterLearnerTraceback(raw)).toBe(raw);
  });
});

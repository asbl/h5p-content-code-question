import { beforeEach, describe, expect, it } from 'vitest';

import {
  createCodeQuestionL10n,
  getCodeQuestionL10nValue,
  tCodeQuestion,
} from '../src/scripts/services/codequestion-l10n.js';

describe('CodeQuestion localization', () => {
  beforeEach(() => {
    H5P.t.mockImplementation((key, _params, library) => `[Missing translation ${library}:${key}]`);
  });

  it('prefers explicit content overrides', () => {
    const l10n = createCodeQuestionL10n({ score: 'Punkte' });

    expect(l10n.score).toBe('Punkte');
    expect(H5P.t).not.toHaveBeenCalled();
  });

  it('uses library translations when H5P provides them', () => {
    H5P.t.mockImplementation((key, _params, library) => (
      key === 'score'
        ? 'Library score'
        : `[Missing translation ${library}:${key}]`
    ));

    expect(getCodeQuestionL10nValue({}, 'score')).toBe('Library score');
  });

  it('falls back to bundled defaults when H5P reports missing translations', () => {
    expect(getCodeQuestionL10nValue({}, 'score')).toBe('Score');
  });

  it('formats placeholders in localized strings', () => {
    expect(tCodeQuestion(
      { dueDateUpcoming: 'Due date: {date}' },
      'dueDateUpcoming',
      { date: '14.03.2026 12:30' },
    )).toBe('Due date: 14.03.2026 12:30');
  });
});
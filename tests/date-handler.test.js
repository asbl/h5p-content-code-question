import { beforeEach, describe, expect, it, vi } from 'vitest';

import DateHandler from '../src/scripts/tester/components/date-handler.js';

const l10n = {
  dueDateUpcoming: 'Due date: {date}.',
  dueDatePassed: 'The due date ({date}) has passed.',
};

describe('DateHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders localized text for upcoming due dates', () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00'));

    const handler = new DateHandler('2026-03-14T12:30:00', l10n);

    expect(handler.getDueText()).toBe('Due date: 14.03.2026 12:30.');
    expect(handler.getDueDateDiv().textContent).toBe('Due date: 14.03.2026 12:30.');
  });

  it('renders localized text for expired due dates', () => {
    vi.setSystemTime(new Date('2026-03-14T14:00:00'));

    const handler = new DateHandler('2026-03-14T12:30:00', l10n);

    expect(handler.getDueText()).toBe('The due date (14.03.2026 12:30) has passed.');
  });

  it('builds a due date meta row with notice and upcoming badge state', () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00'));

    const handler = new DateHandler('2026-03-14T12:30:00', l10n);
    const meta = handler.getDueDateMeta();
    const badge = meta.querySelector('.due-date-badge');

    expect(meta.className).toBe('due-date-meta');
    expect(meta.querySelector('.due-date-notice')?.textContent).toBe('Due date: 14.03.2026 12:30.');
    expect(badge?.classList.contains('not-expired')).toBe(true);
    expect(badge?.querySelector('.due-date')?.textContent).toBe('14.03');
    expect(badge?.querySelector('.due-time')?.textContent).toBe('12:30');
  });

  it('marks expired due dates with the expired badge state', () => {
    vi.setSystemTime(new Date('2026-03-14T14:00:00'));

    const handler = new DateHandler('2026-03-14T12:30:00', l10n);
    const badge = handler.getDueDateBadge();

    expect(badge.classList.contains('expired')).toBe(true);
    expect(badge.getAttribute('title')).toBe('The due date (14.03.2026 12:30) has passed.');
  });
});
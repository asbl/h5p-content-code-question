import { tCodeQuestion } from '../../services/codequestion-l10n';

export default class DateHandler {
  constructor(dueDateString, l10n = {}) {
    this.dueDateString = dueDateString;
    this.l10n = l10n;

    const dueDate = new Date(this.dueDateString);
    const day = String(dueDate.getDate()).padStart(2, '0');
    const month = String(dueDate.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = dueDate.getFullYear();
    const hours = String(dueDate.getHours()).padStart(2, '0');
    const minutes = String(dueDate.getMinutes()).padStart(2, '0');
    this.formattedDate = `${day}.${month}.${year} ${hours}:${minutes}`;
    this.formattedDateShort = `${day}.${month}`;
    this.formattedTime = `${hours}:${minutes}`;
    const now = new Date();
    this.dueExpired = now > dueDate;
  }

  getDueText() {
    if (this.dueExpired) {
      return tCodeQuestion(this.l10n, 'dueDatePassed', {
        date: this.formattedDate,
      });
    }

    return tCodeQuestion(this.l10n, 'dueDateUpcoming', {
      date: this.formattedDate,
    });
  }

  getDueDateDiv() {
    const dueDateDiv = document.createElement('div');
    dueDateDiv.className = 'due-date-notice'; // optional CSS class

    // Set formatted text
    dueDateDiv.textContent = this.getDueText();
    return dueDateDiv;
  }

  getDueDateStatusClass() {
    return this.dueExpired ? 'expired' : 'not-expired';
  }

  getDueDateBadge() {
    const dueDateBadge = document.createElement('div');
    dueDateBadge.className = 'due-date-badge'; // optional CSS class
    dueDateBadge.classList.add(this.getDueDateStatusClass());
    dueDateBadge.setAttribute('title', this.getDueText());
    dueDateBadge.setAttribute('aria-label', this.getDueText());
    const dateDiv = document.createElement('div');
    dateDiv.className = 'due-date'; // optional CSS class
    dateDiv.textContent = this.formattedDateShort;
    const timeDiv = document.createElement('div');
    timeDiv.className = 'due-time'; // optional CSS class
    timeDiv.textContent += this.formattedTime;
    dueDateBadge.appendChild(dateDiv);
    dueDateBadge.appendChild(timeDiv);
    return dueDateBadge;
  }

  getDueDateMeta() {
    const dueDateMeta = document.createElement('div');
    dueDateMeta.className = 'due-date-meta';
    dueDateMeta.append(
      this.getDueDateDiv(),
      this.getDueDateBadge(),
    );
    return dueDateMeta;
  }
}
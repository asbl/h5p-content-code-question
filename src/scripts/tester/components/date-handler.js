export default class DateHandler {
  constructor(dueDateString) {
    this.dueDateString = dueDateString;

    const dueDate = new Date(this.dueDateString);
    const day = String(dueDate.getDate()).padStart(2, '0');
    const month = String(dueDate.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = dueDate.getFullYear();
    const hours = String(dueDate.getHours()).padStart(2, '0');
    const minutes = String(dueDate.getMinutes()).padStart(2, '0');
    this.formattedDate = `${day}.${month}.${year} ${hours}:${minutes}`;
    this.formattedDateShort = `${day}.${month}`;
    const now = new Date();
    this.dueExpired = now > dueDate;
  }

  getDueText() {
    let dueText;
    if (this.dueExpired) {
      dueText = `The due date (${this.formattedDate}) has passed. Submissions will now be graded at half points.`;
    }
    else {
      dueText = `Due Date: ${this.formattedDate}. Submissions after this date will be graded at half points.`;
    }
    return dueText;
  }

  getDueDateDiv() {
    const dueDateDiv = document.createElement('div');
    dueDateDiv.className = 'due-date-notice'; // optional CSS class

    // Set formatted text
    dueDateDiv.textContent = this.getDueText();
    return dueDateDiv;
  }

  getDueDateBadge() {
    const dueDateBadge = document.createElement('div');
    dueDateBadge.className = 'due-date-badge'; // optional CSS class
    const dueDateStatus = this.dueExpired ? 'not-expired' : 'expired';
    dueDateBadge.classList.add(dueDateStatus);
    dueDateBadge.textContent = this.formattedDateShort;
    return dueDateBadge;
  }
}
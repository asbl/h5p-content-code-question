export default class TestCaseView {
  constructor() {
    this.id = `h5p_testcases_area_${H5P.createUUID()}`;
  }

  create() {
    const el = document.createElement('div');
    el.id = this.id;
    el.classList.add('testcases-area');
    return el;
  }

  getTestCasesAreaDiv() {
    return document.getElementById(this.id);
  }

  update(index, passed) {
    // DOM-Update, implemented in subclasses
  }

  getDOM() {
    return this.create();
  }

  resetDOM() {
    const container = this.getTestCasesAreaDiv();
    if (!container) {
      return;
    }

    const freshContainer = this.getDOM();

    if (!freshContainer) {
      container.innerHTML = '';
      container.className = 'testcases-area';
      container.hidden = false;
      container.removeAttribute('style');
      return;
    }

    freshContainer.className = freshContainer.className || 'testcases-area';
    container.replaceWith(freshContainer);
  }
}

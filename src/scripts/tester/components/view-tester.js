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
    // Implemented in subclasses
  }
}

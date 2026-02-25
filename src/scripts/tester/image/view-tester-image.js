import TestCaseView from '../components/view-tester';
import DateHandler from "@scripts/tester/components/date-handler";

/**
 *
 * @description Handles rendering of test case tables, outputs, and merging of canvases.
 */
export default class ImageTesterView extends TestCaseView {

  constructor(l10n, session, results, dueDate, enableDueDate) {
    super();
    this.l10n = l10n;
    /** @private */
    this.session = session;
    this.results = results;
    this.dueDate = dueDate;
    this.enableDueDate = enableDueDate;
  }

  /**
   * Generates the DOM structure for all test cases.
   * @returns {HTMLElement} The root DOM element containing test case tables.
   */
  getDOM() {
    const testCasesArea = super.getDOM();
    testCasesArea.innerHTML = '';

    if (this.enableDueDate && this.dueDate) {
      const dueDateHandler = new DateHandler(this.dueDate);
      const dueDateDiv = dueDateHandler.getDueDateDiv();
      testCasesArea.appendChild(dueDateDiv);

      const dueDateBadge = dueDateHandler.getDueDateBadge();
      testCasesArea.appendChild(dueDateBadge);
    }

    this.session.testcases.forEach((tc, i) => {
      const container = document.createElement('div');
      container.className = 'table-testcase-container image-tester';

      const heading = document.createElement('h3');
      heading.textContent = `${this.l10n.testCase} ${i + 1}`;
      container.appendChild(heading);

      const table = document.createElement('table');
      table.className = `table-testcase table-testcase-${i}`;

      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      ['testInput', 'expectedOutput', 'lastOutput', 'passed'].forEach((key) => {
        const th = document.createElement('td');
        th.textContent = this.l10n[key];
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      const trBody = document.createElement('tr');

      // Input
      const tdInput = document.createElement('td');
      tdInput.className = `input input-${i}`;
      tdInput.innerHTML = tc.hidden
        ? this.l10n.hidden
        : (tc.inputs ?? []).join('<br/>');
      trBody.appendChild(tdInput);

      // Expected
      const tdExpected = document.createElement('td');
      tdExpected.className = `expected tester-image expected-${i}`;
      trBody.appendChild(tdExpected);

      // Output
      const tdOutput = document.createElement('td');
      tdOutput.className = `output user-output output-${i}`;
      trBody.appendChild(tdOutput);

      // Passed
      const tdPassed = document.createElement('td');
      trBody.appendChild(tdPassed);

      tbody.appendChild(trBody);
      table.appendChild(tbody);
      container.appendChild(table);
      testCasesArea.appendChild(container);
    });

    return testCasesArea;
  }

  /**
   * Merges all canvases for a given test case and updates the DOM.
   * @param {number} testCaseIndex - Index of the test case.
   */
  mergeOutputImage(testCaseIndex) {
    const outputCell = this.getOutputCell();
    const mergedCanvas = this._mergeCanvases(outputCell);
    outputCell.innerHTML = '';
    outputCell.append(mergedCanvas);
    return mergedCanvas;
  }

  mergeExpectedImage() {
    const expectedCell = this.getExpectedCell();
    const mergedCanvas = this._mergeCanvases(expectedCell);
    expectedCell.innerHTML = '';
    expectedCell.append(mergedCanvas);
    return mergedCanvas;
  }

  /**
   * Returns the merged canvas element of the user output for a given test case.
   * @returns {HTMLCanvasElement|null}
   */
  getOutputImage() {
    return this.getTestCasesAreaDiv().querySelector(
      `.user-output.output-${this.session.testCaseIndex} canvas.merged`,
    );
  }

  getOutputCell() {
    return this.getTestCasesAreaDiv().querySelector(
      `.user-output.output-${this.session.testCaseIndex}`,
    );
  }

  /**
   * Returns the merged canvas element of the user output for a given test case.
   * @returns {HTMLCanvasElement|null}
   */
  getExpectedCanvas() {
    return this.getTestCasesAreaDiv().querySelector(
      `.expected.expected-${this.session.testCaseIndex} canvas-wrapper`,
    );
  }

  /**
   * Returns the merged canvas element of the user output for a given test case.
   * @returns {HTMLCanvasElement|null}
   */
  getExpectedImage() {
    return this.getTestCasesAreaDiv().querySelector(
      `.expected.expected-${this.session.testCaseIndex} canvas.merged`,
    );
  }

  getExpectedCell() {
    return this.getTestCasesAreaDiv().querySelector(
      `.expected.expected-${this.session.testCaseIndex}`,
    );
  }

  /**
   * Updates the "passed" status cell of a test case in the DOM.
   * @param {number} testCaseIndex
   */
  update() {
    const row = this.getTestCasesAreaDiv().querySelector(
      `.table-testcase-${this.session.testCaseIndex} tbody tr`,
    );
    if (this.results.getSingleScore(this.session.testCaseIndex)) {
      row.classList.add('test-passed');
      row.cells[3].textContent = '✓';
    }
    else {
      row.classList.remove('test-passed');
      row.cells[3].textContent = '✗';
    }
  }

  /**
   * Clears all previous DOM outputs for reset.
   */
  resetDOM() {
    this.getTestCasesAreaDiv()
      ?.querySelectorAll('.user-output, .expected')
      .forEach((el) => (el.innerHTML = ''));
  }

  /**
   * Merges multiple canvases into one canvas element.
   * @private
   * @param {HTMLElement} wrapper - Container holding the canvas elements.
   * @returns {HTMLCanvasElement|null}
   */
  _mergeCanvases(wrapper) {
    if (!wrapper) return null;
    const canvases = wrapper.querySelectorAll('canvas');
    if (!canvases || canvases.length < 2) return null;

    const target = document.createElement('canvas');
    target.width = canvases[0].width;
    target.height = canvases[0].height;
    const ctx = target.getContext('2d');
    canvases.forEach((c) => ctx.drawImage(c, 0, 0));
    target.classList.add('merged');
    return target;
  }

  // Canvas Handling
  addCanvas(canvasWrapper, type, identifier) {
    let targetCell = null;
    if (type === 'testcase') {
      targetCell = this.getOutputCell();
    }
    else {
      targetCell = this.getExpectedCell();
    }

    if (targetCell) targetCell.appendChild(canvasWrapper);
  }

  removeCanvas() {
    // Remove canvases in output
    let parent = this.getOutputCell();
    let canvases = parent.querySelectorAll('.canvas-wrapper');

    canvases.forEach((canvas) => {
      canvas.remove(); // Remove only the canvas element
    });

    // Remove canvases in expected
    parent = this.getExpectedCell();
    canvases = parent.querySelectorAll('.canvas-wrapper');

    canvases.forEach((canvas) => {
      canvas.remove(); // Remove only the canvas element
    });
  }

  showCanvas() {
    // nothing todo; Canvas always visible
  }
}

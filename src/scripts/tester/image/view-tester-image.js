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
    const headers = [
      this.l10n.testInput,
      this.l10n.expectedOutput,
      this.l10n.lastOutput,
      this.l10n.passed,
    ];

    if (this.enableDueDate && this.dueDate) {
      const dueDateHandler = new DateHandler(this.dueDate, this.l10n);
      testCasesArea.appendChild(dueDateHandler.getDueDateMeta());
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
      headers.forEach((label) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = label;
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      const trBody = document.createElement('tr');

      // Input
      const tdInput = document.createElement('td');
      tdInput.className = `input input-${i}`;
      tdInput.dataset.label = headers[0];
      tdInput.innerHTML = tc.hidden
        ? this.l10n.hidden
        : (tc.inputs ?? []).join('<br/>');
      trBody.appendChild(tdInput);

      // Expected
      const tdExpected = document.createElement('td');
      tdExpected.className = `expected tester-image expected-${i}`;
      tdExpected.dataset.label = headers[1];
      tdExpected.appendChild(this.createStatusElement(this.l10n.imageTesterExpectedOutputPending));
      trBody.appendChild(tdExpected);

      // Output
      const tdOutput = document.createElement('td');
      tdOutput.className = `output user-output output-${i}`;
      tdOutput.dataset.label = headers[2];
      tdOutput.appendChild(this.createStatusElement(this.l10n.imageTesterAwaitingOutput));
      trBody.appendChild(tdOutput);

      // Passed
      const tdPassed = document.createElement('td');
      tdPassed.className = `passed passed-${i}`;
      tdPassed.dataset.label = headers[3];
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

    if (!mergedCanvas) {
      return null;
    }

    this.clearCellStatus(outputCell);
    outputCell.replaceChildren(mergedCanvas);
    return mergedCanvas;
  }

  mergeExpectedImage() {
    const expectedCell = this.getExpectedCell();
    const mergedCanvas = this._mergeCanvases(expectedCell);

    if (!mergedCanvas) {
      return null;
    }

    this.clearCellStatus(expectedCell);
    expectedCell.replaceChildren(mergedCanvas);
    return mergedCanvas;
  }

  /**
   * Updates the reference-generation placeholder for a given test case.
   * @param {number} testCaseIndex - Index of the test case.
   * @param {boolean} isGenerating - Whether reference output is being generated.
   * @returns {void}
   */
  setExpectedGenerationState(testCaseIndex, isGenerating) {
    const expectedCell = this.getExpectedCellByIndex(testCaseIndex);

    if (!expectedCell) {
      return;
    }

    if (isGenerating) {
      expectedCell.replaceChildren(this.createStatusElement(this.l10n.imageTesterGeneratingExpectedOutput, true));
      return;
    }

    this.clearCellStatus(expectedCell);
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
    return this.getOutputCellByIndex(this.session.testCaseIndex);
  }

  getOutputCellByIndex(testCaseIndex) {
    return this.getTestCasesAreaDiv().querySelector(
      `.user-output.output-${testCaseIndex}`,
    );
  }

  /**
   * Returns the merged canvas element of the user output for a given test case.
   * @returns {HTMLCanvasElement|null}
   */
  getExpectedCanvas() {
    return this.getTestCasesAreaDiv().querySelector(
      `.expected.expected-${this.session.testCaseIndex} .canvas-wrapper`,
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
    return this.getExpectedCellByIndex(this.session.testCaseIndex);
  }

  getExpectedCellByIndex(testCaseIndex) {
    return this.getTestCasesAreaDiv().querySelector(
      `.expected.expected-${testCaseIndex}`,
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
      ?.querySelectorAll('.user-output')
      .forEach((el) => el.replaceChildren(this.createStatusElement(this.l10n.imageTesterAwaitingOutput)));

    this.getTestCasesAreaDiv()
      ?.querySelectorAll('.expected')
      .forEach((el) => el.replaceChildren(this.createStatusElement(this.l10n.imageTesterExpectedOutputPending)));
  }

  /**
   * Creates a reusable status element for expected or output cells.
   * @param {string} text - Status message.
   * @param {boolean} [loading] - Whether to render a loading spinner.
   * @returns {HTMLDivElement} Status element.
   */
  createStatusElement(text, loading = false) {
    const status = document.createElement('div');
    status.className = `image-tester__status${loading ? ' image-tester__status--loading' : ''}`;

    if (loading) {
      const spinner = document.createElement('span');
      spinner.className = 'image-tester__status-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      status.appendChild(spinner);
    }

    const label = document.createElement('span');
    label.className = 'image-tester__status-label';
    label.textContent = text;
    status.appendChild(label);

    return status;
  }

  /**
   * Removes the status placeholder from a cell before runtime content is added.
   * @param {HTMLElement|null} cell - Target table cell.
   * @returns {void}
   */
  clearCellStatus(cell) {
    cell?.querySelectorAll('.image-tester__status').forEach((status) => status.remove());
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
    if (!canvases || canvases.length === 0) return null;

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

    if (targetCell) {
      this.clearCellStatus(targetCell);
      targetCell.appendChild(canvasWrapper);
    }
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

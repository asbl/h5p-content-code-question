import pixelmatch from 'pixelmatch';
import TestCaseComparator from '../components/comparator';
import { logCodeQuestionDiagnostic } from '../../services/codequestion-diagnostics';

const DEFAULT_RENDER_SETTLE_FRAMES = 3;
const DEFAULT_RENDER_SETTLE_DELAY_MS = 80;
const DEBUG_PREFIX = 'Image comparator:';

function describeCanvas(canvas) {
  if (!canvas) {
    return null;
  }

  return {
    width: canvas.width,
    height: canvas.height,
    className: canvas.className,
    id: canvas.id,
  };
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });
}

function waitForDelay(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Compares output and expected canvas images and optionally shows a visual diff with zoom/pan.
 * Diff color is violet (#A020F0) to avoid confusion with common Turtle graphics colors.
 */
export class ImageTestCaseComparator extends TestCaseComparator {
  /**
   * @param {function(number): HTMLCanvasElement} getOutputCanvas - Function to get output canvas
   * @param {function(number): HTMLCanvasElement} getExpectedCanvas - Function to get expected canvas
   * @param {number} [canvasSize] - Size of canvas (assumes square)
   * @param {number} [maxDiff] - Maximum allowed differing pixels
   * @param {object} [options] - Comparator timing options
   */
  constructor(
    getOutputCanvas,
    getExpectedCanvas,
    canvasSize = 400,
    maxDiff = 20,
    options = {},
  ) {
    super();
    this.getOutputCanvas = getOutputCanvas;
    this.getExpectedCanvas = getExpectedCanvas;
    this.canvasSize = canvasSize;
    this.maxDiff = maxDiff;
    this.renderSettleFrames = Number.isFinite(options.renderSettleFrames)
      ? Math.max(0, options.renderSettleFrames)
      : DEFAULT_RENDER_SETTLE_FRAMES;
    this.renderSettleDelayMs = Number.isFinite(options.renderSettleDelayMs)
      ? Math.max(0, options.renderSettleDelayMs)
      : DEFAULT_RENDER_SETTLE_DELAY_MS;
    this.options = options || {};
  }

  /**
   * Waits until browser-side canvas drawing has had a chance to flush before
   * the source canvas is copied into the merged comparison canvas.
   * @returns {Promise<void>}
   */
  async waitForRenderSettle() {
    const startedAt = Date.now();

    for (let index = 0; index < this.renderSettleFrames; index++) {
      await waitForNextPaint();
    }

    if (this.renderSettleDelayMs > 0) {
      await waitForDelay(this.renderSettleDelayMs);
    }

    logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'render settle done', {
      configuredFrames: this.renderSettleFrames,
      configuredDelayMs: this.renderSettleDelayMs,
      actualElapsedMs: Date.now() - startedAt,
    });
  }

  /**
   * Returns ImageData of a given canvas.
   * @param {HTMLCanvasElement} canvas - Canvas to extract pixel data from
   * @returns {ImageData} Pixel data of the canvas
   */
  getCanvasData(canvas) {
    const context = canvas?.getContext?.('2d');

    if (!context) {
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'missing 2d context', describeCanvas(canvas));
      return null;
    }

    try {
      return context.getImageData(0, 0, this.canvasSize, this.canvasSize);
    }
    catch (error) {
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'failed to read canvas data', {
        canvas: describeCanvas(canvas),
        canvasSize: this.canvasSize,
        error,
      });
      return null;
    }
  }

  /**
   * Computes the pixel difference between output and expected images.
   * @param {ImageData} outputData - ImageData from output canvas
   * @param {ImageData} expectedData - ImageData from expected canvas
   * @returns {{diffPixels: number, diffCanvas: HTMLCanvasElement}} Number of differing pixels and diff canvas
   */
  computeDiff(outputData, expectedData) {
    if (!outputData || !expectedData) {
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'cannot compute diff without image data', {
        hasOutputData: !!outputData,
        hasExpectedData: !!expectedData,
      });
      return { diffPixels: Number.POSITIVE_INFINITY, diffCanvas: null };
    }

    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = this.canvasSize;
    diffCanvas.height = this.canvasSize;
    const diffContext = diffCanvas.getContext('2d');

    if (!diffContext) {
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'failed to create diff canvas context', {
        canvasSize: this.canvasSize,
      });
      return { diffPixels: Number.POSITIVE_INFINITY, diffCanvas: null };
    }

    const diffData = diffContext.createImageData(
      this.canvasSize,
      this.canvasSize,
    );

    const diffPixels = pixelmatch(
      outputData.data,
      expectedData.data,
      diffData.data,
      this.canvasSize,
      this.canvasSize,
      {
        threshold: 0.50,
        includeAA: false,
        alpha: 1,
        diffColor: [160, 32, 240], // Violet (#A020F0)
      },
    );

    diffContext.putImageData(diffData, 0, 0);
    return { diffPixels, diffCanvas };
  }

  /**
   * Shows a modal with the diff canvas, supports zoom/pan, and makes output canvas clickable.
   * @param {HTMLCanvasElement} diffCanvas - The canvas showing pixel differences
   * @param {HTMLCanvasElement} outputCanvas - Original output canvas (clickable to open modal)
   */
  showDiffModal(diffCanvas, outputCanvas) {
    // Make output canvas clickable with hover indicator
    outputCanvas.style.cursor = 'pointer';
    outputCanvas.style.transition = 'box-shadow 0.2s';
    outputCanvas.addEventListener('mouseenter', () => {
      outputCanvas.style.boxShadow = '0 0 10px rgba(160,32,240,0.7)'; // violet highlight
    });
    outputCanvas.addEventListener('mouseleave', () => {
      outputCanvas.style.boxShadow = 'none';
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      overflow: 'hidden',
    });

    const modalContent = document.createElement('div');
    Object.assign(modalContent.style, {
      position: 'relative',
      backgroundColor: '#fff',
      padding: '10px',
      borderRadius: '8px',
      overflow: 'hidden',
      cursor: 'grab',
    });

    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.width = `${this.canvasSize}px`;
    canvasWrapper.style.height = `${this.canvasSize}px`;
    canvasWrapper.style.overflow = 'hidden';
    canvasWrapper.appendChild(diffCanvas);

    modalContent.appendChild(canvasWrapper);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '5px',
      right: '5px',
    });
    closeBtn.addEventListener('click', () => (modal.style.display = 'none'));
    modalContent.appendChild(closeBtn);

    // Zoom buttons
    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    Object.assign(zoomInBtn.style, {
      position: 'absolute',
      bottom: '10px',
      left: '10px',
    });

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '−';
    Object.assign(zoomOutBtn.style, {
      position: 'absolute',
      bottom: '10px',
      left: '50px',
    });

    modalContent.appendChild(zoomInBtn);
    modalContent.appendChild(zoomOutBtn);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // --- Zoom and Pan logic ---
    let scale = 1;
    let originX = 0;
    let originY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    diffCanvas.style.transformOrigin = '0 0';

    canvasWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale *= delta;
      scale = Math.min(Math.max(scale, 1), 10);
      diffCanvas.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    });

    canvasWrapper.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - originX;
      startY = e.clientY - originY;
      canvasWrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      canvasWrapper.style.cursor = 'grab';
    });

    canvasWrapper.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      originX = e.clientX - startX;
      originY = e.clientY - startY;
      diffCanvas.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    });

    zoomInBtn.addEventListener('click', () => {
      scale *= 1.1;
      scale = Math.min(scale, 10);
      diffCanvas.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    });

    zoomOutBtn.addEventListener('click', () => {
      scale *= 0.9;
      scale = Math.max(scale, 1);
      diffCanvas.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    });

    // Open modal when clicking the output canvas
    outputCanvas.addEventListener('click', () => {
      modal.style.display = 'flex';
      scale = 1;
      originX = 0;
      originY = 0;
      diffCanvas.style.transform = 'translate(0px, 0px) scale(1)';
    });
  }

  /**
   * Compare a single test case by calculating pixel differences and optionally displaying a diff modal.
   * @param {number} testCaseIndex - Index of the test case
   * @param {any} testCase - Test case data (not used directly in comparison)
   * @param {string} output - Output string (not used in image comparison)
   * @returns {Promise<boolean>} True if the number of differing pixels is below the maxDiff threshold
   */
  async compare(testCaseIndex, _testCase, _output) {
    this.lastMismatchReason = null;
    logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'start', {
      testCaseIndex,
      canvasSize: this.canvasSize,
      maxDiff: this.maxDiff,
      renderSettleFrames: this.renderSettleFrames,
      renderSettleDelayMs: this.renderSettleDelayMs,
    });

    await this.waitForRenderSettle();

    const outputCanvas = this.getOutputCanvas(testCaseIndex);
    const expectedCanvas = this.getExpectedCanvas(testCaseIndex);
    logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'canvas lookup', {
      testCaseIndex,
      outputCanvas: describeCanvas(outputCanvas),
      expectedCanvas: describeCanvas(expectedCanvas),
    });

    if (!outputCanvas || !expectedCanvas) {
      this.lastMismatchReason = { type: 'missingCanvas' };
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'abort missing canvas', {
        testCaseIndex,
        hasOutputCanvas: !!outputCanvas,
        hasExpectedCanvas: !!expectedCanvas,
      });
      return false;
    }

    await this.waitForRenderSettle();

    const outputData = this.getCanvasData(outputCanvas);
    const expectedData = this.getCanvasData(expectedCanvas);

    if (!outputData || !expectedData) {
      this.lastMismatchReason = { type: 'missingImageData' };
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'abort missing image data', {
        testCaseIndex,
        hasOutputData: !!outputData,
        hasExpectedData: !!expectedData,
      });
      return false;
    }

    const { diffPixels, diffCanvas } = this.computeDiff(
      outputData,
      expectedData,
    );

    if (!diffCanvas) {
      this.lastMismatchReason = { type: 'missingImageData' };
      logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'abort missing diff canvas', {
        testCaseIndex,
        diffPixels,
      });
      return false;
    }

    this.showDiffModal(diffCanvas, outputCanvas);

    const passed = diffPixels <= this.maxDiff;
    if (!passed) {
      this.lastMismatchReason = {
        type: 'imageDifference',
        diffPixels,
        maxDiff: this.maxDiff,
      };
    }

    logCodeQuestionDiagnostic(this.options, DEBUG_PREFIX, 'result', {
      testCaseIndex,
      diffPixels,
      maxDiff: this.maxDiff,
      passed,
    });
    return passed;
  }

  getLastMismatchReason() {
    return this.lastMismatchReason;
  }
}

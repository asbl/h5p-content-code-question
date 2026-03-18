import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ImageTesterView from '../src/scripts/tester/image/view-tester-image.js';

const l10n = {
  testInput: 'Test Input',
  expectedOutput: 'Expected Output',
  lastOutput: 'Last Output',
  passed: 'Passed?',
  testCase: 'Test Case',
  hidden: '[hidden]',
  imageTesterGeneratingExpectedOutput: 'Generating reference output...',
  imageTesterExpectedOutputPending: 'Reference output will be generated during checking.',
  imageTesterAwaitingOutput: 'Waiting for program output...',
};

function createView() {
  return new ImageTesterView(
    l10n,
    {
      testcases: [{ hidden: false, inputs: ['1'] }],
      testCaseIndex: 0,
    },
    {},
    null,
    false,
  );
}

describe('ImageTesterView', () => {
  let originalGetContext;

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';

    if (originalGetContext) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: originalGetContext,
      });
    }
    else {
      delete HTMLCanvasElement.prototype.getContext;
    }
  });

  it('shows a passive expected-output hint until generation starts', () => {
    const view = createView();
    document.body.appendChild(view.getDOM());

    const expectedCell = view.getExpectedCellByIndex(0);

    expect(expectedCell.textContent).toContain(l10n.imageTesterExpectedOutputPending);
    expect(expectedCell.querySelector('.image-tester__status-spinner')).toBeNull();

    view.setExpectedGenerationState(0, true);

    expect(expectedCell.textContent).toContain(l10n.imageTesterGeneratingExpectedOutput);
    expect(expectedCell.querySelector('.image-tester__status-spinner')).not.toBeNull();

    view.resetDOM();

    expect(expectedCell.textContent).toContain(l10n.imageTesterExpectedOutputPending);
    expect(expectedCell.querySelector('.image-tester__status-spinner')).toBeNull();
  });

  it('keeps a single expected canvas visible after merge preparation', () => {
    const view = createView();
    document.body.appendChild(view.getDOM());

    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'canvas-wrapper';

    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    canvasWrapper.appendChild(canvas);

    view.addCanvas(canvasWrapper, 'expected', 0);

    const mergedCanvas = view.mergeExpectedImage();
    const expectedCell = view.getExpectedCellByIndex(0);

    expect(mergedCanvas).not.toBeNull();
    expect(mergedCanvas.classList.contains('merged')).toBe(true);
    expect(expectedCell.querySelector('canvas.merged')).toBe(mergedCanvas);
    expect(expectedCell.querySelector('.canvas-wrapper')).toBeNull();
  });

  it('does not append literal null when no canvas has been rendered yet', () => {
    const view = createView();
    document.body.appendChild(view.getDOM());

    const outputCell = view.getOutputCellByIndex(0);
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'canvas-wrapper';
    outputCell.replaceChildren(canvasWrapper);

    const mergedCanvas = view.mergeOutputImage();

    expect(mergedCanvas).toBeNull();
    expect(outputCell.textContent).not.toContain('null');
    expect(outputCell.querySelector('.canvas-wrapper')).toBe(canvasWrapper);
  });
});
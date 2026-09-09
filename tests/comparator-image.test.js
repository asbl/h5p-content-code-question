import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageTestCaseComparator } from '../src/scripts/tester/image/comparator-image.js';

function createImageData(size, fill = 0) {
  return {
    data: new Uint8ClampedArray(size * size * 4).fill(fill),
  };
}

function createCanvasWithContext(imageData = createImageData(2)) {
  return {
    style: {},
    addEventListener: vi.fn(),
    getContext: vi.fn(() => ({
      getImageData: vi.fn(() => imageData),
    })),
  };
}

const immediateTiming = {
  renderSettleFrames: 0,
  renderSettleDelayMs: 0,
};

describe('ImageTestCaseComparator', () => {
  let warnSpy;
  let originalGetContext;
  let originalRequestAnimationFrame;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalRequestAnimationFrame = window.requestAnimationFrame;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    window.requestAnimationFrame = originalRequestAnimationFrame;

    if (originalGetContext) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: originalGetContext,
      });
    }
    else {
      delete HTMLCanvasElement.prototype.getContext;
    }

    document.body.innerHTML = '';
  });

  it('returns false when either canvas is missing', async () => {
    const comparator = new ImageTestCaseComparator(
      () => null,
      () => createCanvasWithContext(),
      2,
      0,
      immediateTiming,
    );

    expect(await comparator.compare(0)).toBe(false);

    const secondComparator = new ImageTestCaseComparator(
      () => createCanvasWithContext(),
      () => null,
      2,
      0,
      immediateTiming,
    );

    expect(await secondComparator.compare(0)).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('writes image diagnostics only when enabled', async () => {
    const comparator = new ImageTestCaseComparator(
      () => null,
      () => createCanvasWithContext(),
      2,
      0,
      { ...immediateTiming, enableDiagnosticLogs: true },
    );

    expect(await comparator.compare(0)).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'Image comparator:',
      'start',
      expect.objectContaining({ testCaseIndex: 0 }),
    );
  });

  it('returns false when a canvas exists but has no 2d context', async () => {
    const outputCanvas = {
      style: {},
      addEventListener: vi.fn(),
      getContext: vi.fn(() => null),
    };
    const expectedCanvas = createCanvasWithContext();
    const comparator = new ImageTestCaseComparator(
      () => outputCanvas,
      () => expectedCanvas,
      2,
      0,
      immediateTiming,
    );
    const showDiffModalSpy = vi.spyOn(comparator, 'showDiffModal');

    expect(await comparator.compare(0)).toBe(false);
    expect(showDiffModalSpy).not.toHaveBeenCalled();
  });

  it('returns true when the diff is within the threshold and false otherwise', async () => {
    const outputCanvas = createCanvasWithContext();
    const expectedCanvas = createCanvasWithContext();
    const comparator = new ImageTestCaseComparator(
      () => outputCanvas,
      () => expectedCanvas,
      2,
      3,
      immediateTiming,
    );
    const showDiffModalSpy = vi.spyOn(comparator, 'showDiffModal').mockImplementation(() => {});

    vi.spyOn(comparator, 'computeDiff')
      .mockReturnValueOnce({ diffPixels: 3, diffCanvas: document.createElement('canvas') })
      .mockReturnValueOnce({ diffPixels: 4, diffCanvas: document.createElement('canvas') });

    expect(await comparator.compare(0)).toBe(true);
    expect(await comparator.compare(0)).toBe(false);
    expect(showDiffModalSpy).toHaveBeenCalledTimes(2);
  });

  it('returns false when diff rendering cannot obtain a canvas context', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => null),
    });

    const comparator = new ImageTestCaseComparator(
      () => createCanvasWithContext(),
      () => createCanvasWithContext(),
      2,
      0,
      immediateTiming,
    );

    expect(comparator.computeDiff(createImageData(2), createImageData(2))).toEqual({
      diffPixels: Number.POSITIVE_INFINITY,
      diffCanvas: null,
    });
  });

  it('waits for render settling before merging canvases for comparison', async () => {
    const outputCanvas = createCanvasWithContext();
    const expectedCanvas = createCanvasWithContext();
    const calls = [];
    window.requestAnimationFrame = vi.fn((callback) => {
      calls.push('raf');
      callback();
      return calls.length;
    });

    const comparator = new ImageTestCaseComparator(
      () => {
        calls.push('output');
        return outputCanvas;
      },
      () => {
        calls.push('expected');
        return expectedCanvas;
      },
      2,
      0,
      {
        renderSettleFrames: 2,
        renderSettleDelayMs: 0,
      },
    );

    vi.spyOn(comparator, 'computeDiff')
      .mockReturnValue({ diffPixels: 0, diffCanvas: document.createElement('canvas') });
    vi.spyOn(comparator, 'showDiffModal').mockImplementation(() => {});

    expect(await comparator.compare(0)).toBe(true);
    expect(calls).toEqual([
      'raf',
      'raf',
      'output',
      'expected',
      'raf',
      'raf',
    ]);
  });
});

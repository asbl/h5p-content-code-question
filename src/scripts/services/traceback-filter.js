/**
 * Removes runtime-internal noise from a Python traceback before it is shown to
 * a learner. Frames from the Pyodide runtime (`/lib/python3xx.zip/_pyodide/...`),
 * from the H5P wrapper (`<exec>` when the learner code is compiled separately
 * as `<h5p-learner-code>`) and the elided `...<N lines>...` markers only hide
 * the exception line the learner needs to read.
 *
 * Messages without a traceback are returned unchanged.
 * @param {string} message - Raw error message.
 * @returns {string} Message limited to the learner's own frames.
 */
export function filterLearnerTraceback(message) {
  const text = String(message ?? '');
  const lines = text.split('\n');
  const frameStart = /^\s*File "([^"]*)", line \d+/;

  if (!lines.some((line) => frameStart.test(line))) {
    return text;
  }

  // Group each "File ..." line with the indented source lines that follow it.
  const blocks = [];
  lines.forEach((line) => {
    if (frameStart.test(line)) {
      blocks.push({ file: line.match(frameStart)[1], lines: [line], isFrame: true });
      return;
    }

    const last = blocks[blocks.length - 1];
    if (last?.isFrame && /^\s+\S/.test(line)) {
      last.lines.push(line);
      return;
    }

    blocks.push({ lines: [line], isFrame: false });
  });

  const frames = blocks.filter((block) => block.isFrame);
  const hasLearnerFile = frames.some((block) => block.file === '<h5p-learner-code>');
  const isInternal = (file) => (hasLearnerFile ? file !== '<h5p-learner-code>' : /^\/lib\/|_pyodide/.test(file));

  const kept = blocks.filter((block) => {
    if (block.isFrame) {
      return !isInternal(block.file);
    }

    return !/^\s*\.\.\.<\d+ lines?>\.\.\.\s*$/.test(block.lines[0]);
  });

  // Never hide everything: fall back to the original text if no frame is left.
  return kept.some((block) => block.isFrame)
    ? kept.flatMap((block) => block.lines).join('\n')
    : text;
}

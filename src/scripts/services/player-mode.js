/**
 * Player mode: a code part is only *played* (run with its output/canvas
 * visible) and the editor is hidden. Optionally the learner may reveal the
 * code via a "Show code" button.
 *
 * Authors configure it per editor:
 * - assignment editor: `editorSettings.playerMode` (or `editorSettings.options.playerMode`)
 * - inline content part: `content.options.playerMode`
 */

/**
 * Reads the raw player settings of one editor definition.
 * Supports the flat layout (`editorSettings.playerMode`), the nested
 * layout (`editorSettings.options.playerMode`) and per-content `options`.
 * @param {object|null} source Editor settings or content item params.
 * @returns {{playerMode: boolean, playerShowCodeButton: boolean}} Normalized settings.
 */
export function normalizePlayerSettings(source = null) {
  const flat = source && typeof source === 'object' ? source : {};
  const nested = flat.options && typeof flat.options === 'object' ? flat.options : {};

  const playerMode = nested.playerMode ?? flat.playerMode;
  const showCodeButton = nested.playerShowCodeButton ?? flat.playerShowCodeButton;

  return {
    playerMode: playerMode === true,
    // The button is offered unless the author explicitly disabled it.
    playerShowCodeButton: showCodeButton !== false,
  };
}

/**
 * Resolves the player container options for one editor instance.
 * @param {object} params Question params.
 * @param {object|null} [contentParams] Inline content item, or null for the assignment editor.
 * @returns {{playerMode: boolean, playerShowCodeButton: boolean}} Container options.
 */
export function resolvePlayerContainerOptions(params = {}, contentParams = null) {
  return normalizePlayerSettings(
    contentParams !== null ? contentParams : params?.editorSettings,
  );
}

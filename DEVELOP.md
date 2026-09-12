Howto - Create your own content type
====================================

H5P.CodeQuestion is a base class (`runnable: 0`, empty `semantics.json`). It
implements all grading/runtime/UI logic, but exposes none of it to the H5P
editor itself — every subclass (H5P.PythonQuestion, H5P.SQLQuestion,
H5P.JavaQuestion, H5P.AutomataQuestion, ...) must declare its own
`semantics.json` that feeds `params.gradingSettings` in the shape this class
expects. If a subclass's semantics.json is missing a field, the corresponding
feature is silently unreachable in the editor — the JS code will work, but
authors can never configure it. This has happened before (`sortItems` and
`bySolution` existed in the base class before any subclass exposed them);
this document exists so it doesn't happen again silently.

## Grading methods

`params.gradingSettings.gradingMethod` selects the grading method. Values
the base class understands:

| Value            | Handled by                              | Needs in subclass `semantics.json`                                   |
|------------------|------------------------------------------|------------------------------------------------------------------------|
| `ioTestCases`    | `IOTester` (via `factory-tester.js`)      | `targetCode` (reference code) + a test cases list                     |
| `targetImage`    | `ImageTester`                             | `targetCode` + a target image field                                    |
| `functionTests`  | `FunctionTester`                          | `targetCode`, `functionName`, optionally `algorithmConstraints`/`algorithmTrace` |
| `bySolution`     | `TablesTester`                            | `targetCode` (reference code; its output is captured as a table and diffed against the learner's) |
| `multipleChoice` | Handled directly in `h5p-codequestion.js`, never creates a code tester | `multipleChoice: { allowMultiple, shuffleAnswers, choices: [{ text, correct }] }` |
| `sortItems`      | Handled directly in `h5p-codequestion.js`, never creates a code tester | `sortItems: { items: [{ text }] }` — correct order is the authoring order; learners see it shuffled |

Any other value (including the `please_choose` placeholder, or a value with
no matching field) makes `CodeQuestion` disable grading for that attempt
(`gradingMethod` is nulled), so an unrecognized value fails silently rather
than throwing. When adding a new grading method to the base class, also add
it to `factory-tester.js`'s `testerMap` (or the direct handling in
`h5p-codequestion.js` for a non-code-tester method like `multipleChoice`/
`sortItems`), and note it in the table above.

`targetCode` is shared across `ioTestCases`/`targetImage`/`functionTests`/
`bySolution` — it's one field in the subclass semantics.json, gated with a
`showWhen` rule listing all four `gradingMethod` values. Don't add a second,
differently-named "solution" field for a new method unless it genuinely
needs different content (e.g. H5P.SQLQuestion and H5P.JavaQuestion have
their own, differently-shaped `solution`/`bySolution` wiring because their
runtimes prepare the reference output differently — check the subclass's
own `*-question.js` before assuming the shared field is enough).

## Adding a grading method / option to a subclass

1. Add the `gradingMethod` select option (`value`/`label`) in the subclass's
   `semantics.json`.
2. Add whatever fields the method needs (see table above), gated with a
   `showWhen` rule on `gradingMethod`.
3. **Update every `language/<lang>.json` in that subclass to match.** The H5P
   editor's translation overlay must have the exact same field structure
   (same groups, same list/field nesting) as `semantics.json`, just with
   translated `label`/`description`/`entity` strings — nothing else. This is
   easy to forget because the feature works fine in the default language
   without it; it only breaks for editors running in that other language.
   H5P.PythonQuestion has `tests/semantics-language.test.js`, which fails the
   build the moment `semantics.json` and `language/de.json` diverge
   structurally. If you're working on a subclass that has a `language/`
   translation (not just `language/en.json`, which mirrors `semantics.json`
   and isn't itself a translation), port that test in rather than relying on
   manual review.
4. Bump the subclass's own `library.json` `minorVersion`, and if the change
   depended on a new base-class capability, bump the pinned
   `H5P.CodeQuestion` dependency version in `preloadedDependencies` to match
   (or higher than) the CodeQuestion version that introduced it.
5. Run `npm test` in both the subclass and, if you touched CodeQuestion
   itself, in H5P.CodeQuestion — the subclass's tests mock CodeQuestion's
   internals, so a base-class behavior change can pass there while still
   breaking a subclass silently until you check.

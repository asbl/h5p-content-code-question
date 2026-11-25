import { tCodeQuestion } from '../../services/codequestion-l10n';

const CONSTRAINT_LABELS = {
  'Required function not found': 'constraintRequiredFunctionNotFound',
  'Recursion required': 'constraintRecursionRequired',
  'Recursion base case required': 'constraintBaseCaseRequired',
  'Too many recursive calls': 'constraintTooManyRecursiveCalls',
  'Loop required': 'constraintLoopRequired',
  'For loop required': 'constraintForLoopRequired',
  'While loop required': 'constraintWhileLoopRequired',
  'Too many loops': 'constraintTooManyLoops',
  'Loop nesting too deep': 'constraintLoopNestingTooDeep',
  'Loops are not allowed': 'constraintLoopsForbidden',
  'Conditional required': 'constraintConditionalRequired',
  'Return statement required': 'constraintReturnRequired',
  'Top-level assignments are not allowed': 'constraintTopLevelAssignmentsForbidden',
  'Constructor required': 'constraintConstructorRequired',
  'Object instantiation required': 'constraintObjectInstantiationRequired',
  'Inheritance required': 'constraintInheritanceRequired',
  'Inheritance is not allowed': 'constraintInheritanceForbidden',
};

function translateConstraintViolation(l10n, violation) {
  const text = String(violation || '').trim();
  if (!text) {
    return '';
  }

  if (CONSTRAINT_LABELS[text]) {
    return tCodeQuestion(l10n, CONSTRAINT_LABELS[text]);
  }

  if (text === 'Forbidden data structure: list') {
    return tCodeQuestion(l10n, 'constraintForbiddenList');
  }

  const prefixed = [
    ['Required data structure: ', 'constraintRequiredDataStructure'],
    ['Forbidden data structure: ', 'constraintForbiddenDataStructure'],
    ['Forbidden call: ', 'constraintForbiddenCall'],
    ['Required class: ', 'constraintRequiredClass'],
    ['Forbidden class: ', 'constraintForbiddenClass'],
    ['Required method parameters: ', 'constraintRequiredMethodParameters'],
    ['Required typed method: ', 'constraintRequiredTypedMethod'],
    ['Required method: ', 'constraintRequiredMethod'],
    ['Required instance attribute: ', 'constraintRequiredAttribute'],
    ['Required typed attribute: ', 'constraintRequiredTypedAttribute'],
    ['Missing parameter type hint: ', 'constraintParameterAnnotationMissing'],
    ['Missing return type hint: ', 'constraintReturnAnnotationMissing'],
    ['Required private attribute: ', 'constraintRequiredPrivateAttribute'],
    ['Attribute must not also be public: ', 'constraintAttributeMustNotBePublic'],
    ['Required property getter: ', 'constraintRequiredPropertyGetter'],
    ['Required property setter: ', 'constraintRequiredPropertySetter'],
    ['External access to protected attribute: ', 'constraintExternalAttributeAccess'],
  ].find(([prefix]) => text.startsWith(prefix));

  if (prefixed) {
    const [prefix, key] = prefixed;
    return tCodeQuestion(l10n, key, { value: text.slice(prefix.length) });
  }

  if (text.startsWith('Constraint analysis failed')) {
    return tCodeQuestion(l10n, 'constraintAnalysisFailed');
  }

  return text;
}

// Only strings/numbers are ever meant to end up in a constraint label; stringifying a
// stray object here would otherwise silently produce "[object Object]" in the UI.
function toText(value) {
  return (typeof value === 'string' || typeof value === 'number') ? String(value).trim() : '';
}

function normalizeList(values, property = null) {
  const entries = Array.isArray(values)
    ? values.map((value) => (property
      ? toText(value?.[property])
      : toText(value?.structure) || toText(value?.name) || toText(value)))
    : String(values || '').split(',').map((value) => toText(value));

  return entries.filter(Boolean);
}

function normalizeParameterList(value) {
  return (Array.isArray(value) ? value.map((entry) => toText(entry)) : String(value || '').split(',').map((entry) => toText(entry)))
    .filter((entry) => entry && entry !== 'self');
}

function describeConfiguredConstraint(l10n, key, value = '') {
  return tCodeQuestion(l10n, key, { value });
}

function describeConfiguredConstraints(l10n, constraints = {}) {
  const descriptions = [];

  [
    ['requireRecursion', 'constraintRecursionRequired'],
    ['requireBaseCase', 'constraintBaseCaseRequired'],
    ['forbidLoops', 'constraintLoopsForbidden'],
    ['requireConditional', 'constraintConditionalRequired'],
    ['requireReturn', 'constraintReturnRequired'],
    ['forbidTopLevelAssignments', 'constraintTopLevelAssignmentsForbidden'],
    ['requireConstructor', 'constraintConstructorRequired'],
    ['requireObjectInstantiation', 'constraintObjectInstantiationRequired'],
    ['requireInheritance', 'constraintInheritanceRequired'],
    ['forbidInheritance', 'constraintInheritanceForbidden'],
    ['requireParameterAnnotations', 'constraintParameterAnnotationsRequired'],
    ['requireReturnAnnotation', 'constraintReturnAnnotationRequired'],
  ].forEach(([field, key]) => {
    if (constraints[field] === true) {
      descriptions.push(describeConfiguredConstraint(l10n, key));
    }
  });

  const requiredLoop = constraints.requiredLoop;
  if (requiredLoop === 'any') descriptions.push(describeConfiguredConstraint(l10n, 'constraintLoopRequired'));
  if (requiredLoop === 'for') descriptions.push(describeConfiguredConstraint(l10n, 'constraintForLoopRequired'));
  if (requiredLoop === 'while') descriptions.push(describeConfiguredConstraint(l10n, 'constraintWhileLoopRequired'));

  normalizeList(constraints.requiredDataStructures)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintRequiredDataStructure', value)));
  normalizeList(constraints.forbiddenDataStructures)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintForbiddenDataStructure', value)));
  normalizeList(constraints.forbiddenCalls)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintForbiddenCall', value)));
  normalizeList(constraints.requiredClassNames)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintRequiredClass', value)));
  normalizeList(constraints.forbiddenClassNames)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintForbiddenClass', value)));
  normalizeList(constraints.requiredMethodNames)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintRequiredMethod', value)));
  normalizeList(constraints.requiredInstanceAttributes)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintRequiredAttribute', value)));
  normalizeList(constraints.requiredClasses, 'className')
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintRequiredClass', value)));

  (Array.isArray(constraints.requiredMethods) ? constraints.requiredMethods : [])
    .forEach((method) => {
      const methodName = String(method?.methodName ?? method?.name ?? method ?? '').trim();
      if (!methodName) return;
      const className = String(method?.className || '').trim();
      const label = `${className ? `${className}.` : ''}${methodName}`;
      const parameters = normalizeParameterList(method?.parameters);
      descriptions.push(describeConfiguredConstraint(
        l10n,
        parameters.length ? 'constraintRequiredMethodParameters' : 'constraintRequiredMethod',
        parameters.length ? `${label}(${parameters.join(', ')})` : label,
      ));
    });

  (Array.isArray(constraints.requiredTypedMethods) ? constraints.requiredTypedMethods : [])
    .forEach((method) => {
      const methodName = String(method?.methodName ?? method?.name ?? method ?? '').trim();
      if (!methodName) return;
      const className = String(method?.className || '').trim();
      const label = `${className ? `${className}.` : ''}${methodName}`;
      descriptions.push(describeConfiguredConstraint(l10n, 'constraintRequiredTypedMethod', label));
    });

  normalizeList(constraints.requiredPrivateAttributes, 'attributeName')
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintRequiredPrivateAttribute', value)));

  (Array.isArray(constraints.requiredProperties) ? constraints.requiredProperties : [])
    .forEach((property) => {
      const attributeName = String(property?.attributeName ?? property?.name ?? property ?? '').trim();
      if (!attributeName) return;
      const className = String(property?.className || '').trim();
      const label = `${className ? `${className}.` : ''}${attributeName}`;
      descriptions.push(describeConfiguredConstraint(
        l10n,
        property?.requireSetter === true ? 'constraintRequiredPropertySetter' : 'constraintRequiredPropertyGetter',
        label,
      ));
    });

  normalizeList(constraints.protectedAttributeNames)
    .forEach((value) => descriptions.push(describeConfiguredConstraint(l10n, 'constraintExternalAttributeAccess', value)));

  (Array.isArray(constraints.requiredAttributes) ? constraints.requiredAttributes : [])
    .forEach((attribute) => {
      const attributeName = String(attribute?.attributeName ?? attribute?.name ?? attribute ?? '').trim();
      if (!attributeName) return;
      const className = String(attribute?.className || '').trim();
      descriptions.push(describeConfiguredConstraint(
        l10n,
        'constraintRequiredAttribute',
        `${className ? `${className}.` : ''}${attributeName}`,
      ));
    });

  return [...new Set(descriptions)];
}

/**
 * Formats the error detail of a failed function call. The harness appends
 * " @<line>" to the first line when it could locate the failing learner line;
 * later lines (e.g. a hint) are kept as they are.
 * @param {object} l10n Localization map.
 * @param {string} detail Raw detail from the test harness.
 * @returns {string} Readable error text.
 */
function describeFunctionError(l10n, detail) {
  const text = String(detail || '').trim();
  if (!text) {
    return tCodeQuestion(l10n, 'constraintUnknown');
  }

  const [firstLine, ...rest] = text.split('\n');
  const match = firstLine.match(/^(.*?)\s@(\d+)$/);
  const head = match
    ? tCodeQuestion(l10n, 'functionTesterErrorAtLine', { error: match[1], line: match[2] })
    : firstLine;

  return [head, ...rest].join('\n');
}

export function describeFailureReason(l10n, reason) {
  if (!reason) {
    return '';
  }

  if (reason.type === 'multipleFailures') {
    return reason.reasons.map((failure) => describeFailureReason(l10n, failure)).filter(Boolean).join('\n\n');
  }

  if (reason.type === 'lineCountMismatch') {
    return tCodeQuestion(l10n, 'outputLineCountMismatch', {
      actual: reason.actualCount,
      expected: reason.expectedCount,
    });
  }

  if (reason.type === 'lineContentMismatch') {
    return tCodeQuestion(l10n, 'outputLineContentMismatch', {
      line: reason.line,
      expected: reason.expectedValue,
      actual: reason.actualValue,
    });
  }

  if (reason.type === 'algorithmConstraintMismatch') {
    const violations = (Array.isArray(reason.violations) ? reason.violations : [])
      .map((violation) => translateConstraintViolation(l10n, violation))
      .filter(Boolean);
    const configuredConstraints = describeConfiguredConstraints(l10n, reason.constraints);
    const fallback = configuredConstraints.length
      ? tCodeQuestion(l10n, reason.missingResult ? 'algorithmConstraintNoResultWithConfigured' : 'algorithmConstraintUnknownWithConfigured', {
        constraints: configuredConstraints.join('; '),
      })
      : tCodeQuestion(l10n, 'constraintUnknown');

    return tCodeQuestion(l10n, 'algorithmConstraintMismatch', {
      violations: violations.length ? violations.join('; ') : fallback,
    });
  }

  if (reason.type === 'functionResultMismatch') {
    if (reason.status === 'error') {
      return tCodeQuestion(l10n, 'functionTesterFailedWithError', {
        error: describeFunctionError(l10n, reason.detail),
      });
    }

    if (reason.status === 'configuration') {
      const configurationErrors = {
        'Arguments and expected result must be valid JSON values.': 'functionTesterInvalidJson',
        'Configure an expected result as JSON.': 'functionTesterMissingExpectedResult',
        'Configure a valid Python function name.': 'functionTesterInvalidFunctionName',
      };
      return tCodeQuestion(l10n, 'functionTesterConfigurationFailed', {
        error: configurationErrors[reason.detail]
          ? tCodeQuestion(l10n, configurationErrors[reason.detail])
          : (reason.detail || tCodeQuestion(l10n, 'constraintUnknown')),
      });
    }

    if (reason.status === 'limit') {
      const [used = '?', max = '?'] = String(reason.detail || '').split(':');
      return tCodeQuestion(l10n, 'functionTesterOperationLimit', { used, max });
    }

    return tCodeQuestion(l10n, 'functionTesterResultMismatch');
  }

  if (reason.type === 'missingCanvas') {
    return tCodeQuestion(l10n, 'imageTesterMissingCanvas');
  }

  if (reason.type === 'missingImageData') {
    return tCodeQuestion(l10n, 'imageTesterMissingImageData');
  }

  if (reason.type === 'imageDifference') {
    return tCodeQuestion(l10n, 'imageTesterDifference', {
      diff: reason.diffPixels,
      max: reason.maxDiff,
    });
  }

  return tCodeQuestion(l10n, 'testFailureReasonGeneric');
}

/**
 * Shows or hides the full-width failure detail row below a testcase's main row.
 * Keeping it out of the narrow "passed" column makes long constraint
 * explanations readable instead of wrapping into a cramped cell.
 * @param {HTMLTableCellElement} statusCell - The "passed" cell of the testcase row.
 * @param {string} reasonText - Failure detail text, or '' to remove the row.
 * @returns {void}
 */
function updateReasonRow(statusCell, reasonText) {
  const row = statusCell.closest('tr');
  if (!row || !row.parentNode) return;

  const existingReasonRow = row.nextElementSibling?.classList?.contains('testcase-reason-row')
    ? row.nextElementSibling
    : null;

  if (!reasonText) {
    existingReasonRow?.remove();
    return;
  }

  const reasonRow = existingReasonRow || document.createElement('tr');
  if (!existingReasonRow) {
    reasonRow.className = 'testcase-reason-row';
    const reasonCell = document.createElement('td');
    reasonCell.className = 'testcase-reason-cell';
    reasonCell.setAttribute('aria-live', 'polite');
    reasonCell.colSpan = row.cells.length;
    reasonRow.appendChild(reasonCell);
    row.parentNode.insertBefore(reasonRow, row.nextSibling);
  }

  reasonRow.querySelector('.testcase-reason-cell').textContent = reasonText;
}

export function setPassedCellStatus(cell, l10n, passed, reason = null) {
  if (!cell) return;

  const label = passed
    ? (l10n.testPassed || l10n.successText || 'Test passed')
    : (l10n.testFailed || l10n.failedText || 'Test failed');
  const reasonText = passed ? '' : describeFailureReason(l10n, reason || { type: 'genericFailure' });
  const fullLabel = reasonText ? `${label}: ${reasonText}` : label;

  cell.replaceChildren();

  const mark = document.createElement('span');
  mark.className = 'testcase-passed-mark';
  mark.textContent = passed ? '✓' : '✗';
  cell.appendChild(mark);

  cell.setAttribute('aria-label', fullLabel);
  cell.title = fullLabel;

  updateReasonRow(cell, reasonText);
}

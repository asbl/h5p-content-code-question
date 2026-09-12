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

  const prefixed = [
    ['Required data structure: ', 'constraintRequiredDataStructure'],
    ['Forbidden data structure: ', 'constraintForbiddenDataStructure'],
    ['Forbidden call: ', 'constraintForbiddenCall'],
    ['Required class: ', 'constraintRequiredClass'],
    ['Forbidden class: ', 'constraintForbiddenClass'],
    ['Required method parameters: ', 'constraintRequiredMethodParameters'],
    ['Required method: ', 'constraintRequiredMethod'],
    ['Required instance attribute: ', 'constraintRequiredAttribute'],
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

function normalizeList(values, property = null) {
  const entries = Array.isArray(values)
    ? values.map((value) => (property ? value?.[property] : value?.structure ?? value?.name ?? value))
    : String(values || '').split(',');

  return entries
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeParameterList(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((entry) => String(entry || '').trim())
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
    ['requireConditional', 'constraintConditionalRequired'],
    ['requireReturn', 'constraintReturnRequired'],
    ['forbidTopLevelAssignments', 'constraintTopLevelAssignmentsForbidden'],
    ['requireConstructor', 'constraintConstructorRequired'],
    ['requireObjectInstantiation', 'constraintObjectInstantiationRequired'],
    ['requireInheritance', 'constraintInheritanceRequired'],
    ['forbidInheritance', 'constraintInheritanceForbidden'],
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

export function describeFailureReason(l10n, reason) {
  if (!reason) {
    return '';
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
        error: reason.detail || tCodeQuestion(l10n, 'constraintUnknown'),
      });
    }

    if (reason.status === 'configuration') {
      return tCodeQuestion(l10n, 'functionTesterConfigurationFailed', {
        error: reason.detail || tCodeQuestion(l10n, 'constraintUnknown'),
      });
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

  if (reasonText) {
    const reasonEl = document.createElement('span');
    reasonEl.className = 'testcase-mismatch-reason';
    reasonEl.textContent = reasonText;
    cell.appendChild(reasonEl);
  }

  cell.setAttribute('aria-label', fullLabel);
  cell.title = fullLabel;
}

import { describe, expect, it } from 'vitest';

import { describeFailureReason } from '../src/scripts/tester/components/failure-reason.js';
import defaultLanguage from '../src/scripts/services/default-language.json';

describe('describeFailureReason - type hint and encapsulation constraints', () => {
  it('explains required attribute annotations', () => {
    const message = describeFailureReason({}, {
      type: 'algorithmConstraintMismatch',
      violations: ['Required typed attribute: Tuerschloss._offen: bool'],
    });
    expect(message).toContain('Tuerschloss._offen: bool');
    expect(message).toContain('type annotation');
  });

  it('translates each new violation message using the bundled default language', () => {
    const reason = {
      type: 'algorithmConstraintMismatch',
      violations: [
        'Missing parameter type hint: deposit(amount)',
        'Missing return type hint: deposit',
        'Required typed method: BankAccount.deposit(amount: float) -> float',
        'Required private attribute: BankAccount.balance',
        'Attribute must not also be public: BankAccount.balance',
        'Required property getter: BankAccount.balance',
        'Required property setter: BankAccount.balance',
        'External access to protected attribute: _balance',
      ],
      constraints: {},
      missingResult: false,
    };

    const message = describeFailureReason(defaultLanguage.libraryStrings, reason);

    expect(message).toContain('deposit(amount) is missing a type hint');
    expect(message).toContain('deposit is missing a return type hint');
    expect(message).toContain('BankAccount.deposit(amount: float) -> float does not have the required parameter/return types');
    expect(message).toContain('BankAccount.balance must be stored under a private name (_name)');
    expect(message).toContain('BankAccount.balance must not also exist as a public attribute');
    expect(message).toContain('BankAccount.balance is missing');
    expect(message).toContain('BankAccount.balance is missing a setter');
    expect(message).toContain('_balance must not be accessed directly from outside the class');
  });

  it('falls back to describing configured-but-unverified constraints when analysis produced no result', () => {
    const reason = {
      type: 'algorithmConstraintMismatch',
      violations: [],
      missingResult: true,
      constraints: {
        requireParameterAnnotations: true,
        requireReturnAnnotation: true,
        requiredTypedMethods: [{ className: 'BankAccount', methodName: 'deposit' }],
        requiredPrivateAttributes: [{ attributeName: 'balance' }],
        requiredProperties: [{ className: 'BankAccount', attributeName: 'balance', requireSetter: true }],
        protectedAttributeNames: '_balance',
      },
    };

    const message = describeFailureReason(defaultLanguage.libraryStrings, reason);

    expect(message).toContain('every parameter needs a type hint');
    expect(message).toContain('every function/method needs a return type hint');
    expect(message).toContain('BankAccount.deposit does not have the required parameter/return types');
    expect(message).toContain('balance must be stored under a private name');
    expect(message).toContain('BankAccount.balance is missing a setter');
    expect(message).toContain('_balance must not be accessed directly from outside the class');
  });
});

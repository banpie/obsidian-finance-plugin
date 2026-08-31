/**
 * Run:
 *   npx ts-node --skip-project --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"lib":["ES2020","DOM"]}' scripts/test-account-labels.ts
 */

import { strict as assert } from 'assert';
import { getBalanceAccountDisplayName, getBalanceCategoryLabel } from '../src/utils/accountLabels';

assert.equal(getBalanceCategoryLabel('Assets:Loans:Lend-example'), 'Loan Receivables');
assert.equal(getBalanceCategoryLabel('Liabilities:Loans:Borrow-example'), 'Loan Payables');
assert.equal(getBalanceCategoryLabel('Assets:Accounts:Bank'), 'Accounts');
assert.equal(getBalanceCategoryLabel('Expenses:Daily:Rent'), 'Daily');
assert.equal(getBalanceAccountDisplayName('Assets:Loans', 'Loans'), 'Loan Receivables');
assert.equal(getBalanceAccountDisplayName('Liabilities:Loans', 'Loans'), 'Loan Payables');
assert.equal(getBalanceAccountDisplayName('Assets:Accounts', 'Accounts'), 'Accounts');

console.log('account label tests passed');

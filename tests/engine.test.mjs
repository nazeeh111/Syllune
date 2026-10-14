import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, checkWork, derivative } from '../web/engine.js';
test('linear equation transformations preserve solutions', () => {
  assert.equal(compare('2x + 6 = 14', '2x = 8').status, 'correct');
  assert.equal(compare('2x = 8', 'x = 4').status, 'correct');
  assert.equal(compare('2x = 8', 'x = 8').status, 'incorrect');
});
test('first wrong step is localized', () => {
  const r = checkWork('2x+6=14\n2x=20\nx=10');
  assert.equal(r.firstIssue, 1);
  assert.equal(r.steps[1].status, 'incorrect');
  assert.equal(r.steps[2].status, 'blocked');
});
test('quadratic roots cannot be silently lost', () => {
  assert.equal(compare('x^2=4', 'x=2').status, 'incorrect');
  assert.equal(compare('x^2=4', 'x=-2 or x=2').status, 'correct');
  assert.equal(compare('(x-2)^2=0', 'x=2').status, 'correct');
  assert.equal(compare('x^2+1=0', 'x^2+4=0').status, 'correct');
});
test('identities and contradictions are distinguished', () => {
  assert.equal(compare('x=x', '0=0').status, 'correct');
  assert.equal(compare('x=x', 'x=0').status, 'incorrect');
  assert.equal(compare('0=1', 'x^2+1=0').status, 'correct');
});
test('exact decimals, fractions, expansion and precedence', () => {
  for (const [a, b] of [
    ['0.1+0.2', '0.3'],
    ['1/3+1/6', '1/2'],
    ['(x+2)^2', 'x^2+4x+4'],
    ['-x^2', '-(x^2)'],
    ['2(x+1)', '2x+2'],
  ])
    assert.equal(compare(a, b).status, 'correct');
  assert.equal(compare('(x+2)^2', 'x^2+4').status, 'incorrect');
});
test('unsupported domain-changing operations are unverified', () => {
  for (const a of ['x/x', 'sqrt(x)', 'sin(x)', 'x^-1', 'y+1', 'x^9'])
    assert.equal(compare(a, '1').status, 'unverified');
  assert.equal(compare('x^3=1', 'x=1').status, 'unverified');
});
test('polynomial derivative and derivative transition', () => {
  assert.equal(derivative('3x^3 - x + 4'), '9x^2 - 1');
  assert.equal(compare('d/dx(3x^3-x+4)', '9x^2-1').status, 'correct');
  assert.equal(compare('d/dx(x^2)', 'x').status, 'incorrect');
});
test('malformed, oversized and dangerous input stays unverified', () => {
  for (const s of [
    '1/0',
    '2..3',
    'x=2=3',
    'globalThis.alert(1)',
    '('.repeat(100) + 'x' + ')'.repeat(100),
    '9'.repeat(5000),
  ])
    assert.equal(compare(s, '0').status, 'unverified');
  assert.equal(checkWork('x=2').steps[0].status, 'start');
});
test('equation/ expression mismatch cannot pass', () =>
  assert.equal(compare('x=2', '2').status, 'unverified'));
test('every alternative is validated even after an identity', () => {
  assert.equal(compare('0=0 or sin(x)=1', '0=0').status, 'unverified');
  assert.equal(compare('0=0 or x==2', '0=0').status, 'unverified');
});

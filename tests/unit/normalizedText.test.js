import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizedToString, normalizedToDisplayString, normalizedToDisplayStringForTarget, extractEditableText } from '../../src/utils/normalizedText.ts';

describe('normalizedText utilities', () => {
  test('normalizedToString handles empty and invalid inputs', () => {
    assert.equal(normalizedToString([]), '');
    assert.equal(normalizedToString(null), '');
    assert.equal(normalizedToString(undefined), '');
    assert.equal(normalizedToString('not-an-array'), '');
  });

  test('normalizedToString handles string items', () => {
    const input = ['Hello', ' ', 'world'];
    assert.equal(normalizedToString(input), 'Hello world');
  });

  test('normalizedToString handles variable placeholders with sample values', () => {
    const input = [
      'Hello ',
      { t: 'x', v: '{0}', s: 'John' },
      '!'
    ];
    assert.equal(normalizedToString(input), 'Hello John!');
  });

  test('normalizedToString handles variable placeholders without sample values', () => {
    const input = [
      'Hello ',
      { t: 'x', v: '{0}' },
      '!'
    ];
    assert.equal(normalizedToString(input), 'Hello {0}!');
  });

  test('normalizedToString handles bx/ex tag placeholders', () => {
    const input = [
      'Click ',
      { t: 'bx', v: '<a href="example.com">' },
      'here',
      { t: 'ex', v: '</a>' },
      ' now'
    ];
    assert.equal(normalizedToString(input), 'Click <a>here</a> now');
  });

  test('normalizedToString handles complex tag names', () => {
    const input = [
      { t: 'bx', v: '<strong class="bold">' },
      'Bold text',
      { t: 'ex', v: '</strong>' }
    ];
    assert.equal(normalizedToString(input), '<strong>Bold text</strong>');
  });

  test('normalizedToDisplayString shows variables with curly braces', () => {
    const input = [
      'Hello ',
      { t: 'x', v: '{0}', s: 'John' },
      '!'
    ];
    assert.equal(normalizedToDisplayString(input), 'Hello {John}!');
  });

  test('normalizedToDisplayString handles variables without sample values', () => {
    const input = [
      'Hello ',
      { t: 'x', v: '{0}' },
      '!'
    ];
    assert.equal(normalizedToDisplayString(input), 'Hello {{0}}!');
  });

  test('normalizedToDisplayString shows unknown placeholders with brackets', () => {
    const input = [
      'Text ',
      { t: 'unknown', v: 'something' },
      ' end'
    ];
    assert.equal(normalizedToDisplayString(input), 'Text [something] end');
  });

  test('normalizedToDisplayStringForTarget removes brackets from unknown placeholders', () => {
    const input = [
      'Text ',
      { t: 'unknown', v: 'something' },
      ' end'
    ];
    assert.equal(normalizedToDisplayStringForTarget(input), 'Text something end');
  });

  test('extractEditableText returns only string items', () => {
    const input = [
      'Hello ',
      { t: 'x', v: '{0}', s: 'John' },
      'world',
      { t: 'bx', v: '<a>' },
      '!'
    ];
    const result = extractEditableText(input);
    assert.deepEqual(result, ['Hello ', 'world', '!']);
  });

  test('extractEditableText handles empty inputs', () => {
    assert.deepEqual(extractEditableText([]), []);
    assert.deepEqual(extractEditableText(null), []);
    assert.deepEqual(extractEditableText(undefined), []);
  });
});
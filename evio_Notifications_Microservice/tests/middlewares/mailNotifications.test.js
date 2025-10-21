const { replaceAll } = require('../../middlewares/mailNotifications');

describe('replaceAll function', () => {
  it('replaces all occurrences of substrings based on map', () => {
    const str = 'This is a test. This test is simple.';
    const mapObj = { This: 'That', test: 'exam' };
    expect(replaceAll(str, mapObj)).toBe('That is a exam. That exam is simple.');
  });

  it('returns the original string when map is empty', () => {
    const str = 'Nothing to replace here.';
    const mapObj = { exam: 'test' };
    expect(replaceAll(str, mapObj)).toBe(str);
  });

  it('replaces with special characters and multiple words', () => {
    const str = 'Hello, world! Hello again!';
    const mapObj = { Hello: 'Hi', 'world!': 'universe!', again: 'back' };
    expect(replaceAll(str, mapObj)).toBe('Hi, universe! Hi back!');
  });

  it('works with overlapping keys in map', () => {
    const str = 'abc abc';
    const mapObj = { a: '1', ab: '2', abc: '3' };
    expect(replaceAll(str, mapObj)).toBe('3 3');
  });
});

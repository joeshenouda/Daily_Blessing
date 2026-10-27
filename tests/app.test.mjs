import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dateKey, parseDate, shiftDay, getBook, escapeHtml, splitQuestions, progressKey, loadStorage } from '../public/lib.js';

const dataset = JSON.parse(await readFile(new URL('../public/assignments.json', import.meta.url), 'utf8'));

test('calendar arithmetic respects real dates and year boundaries', () => {
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftDay('2027-02-28', 1), '2027-03-01');
  assert.equal(shiftDay('2028-02-28', 1), '2028-02-29');
  assert.equal(parseDate('2027-02-29'), null);
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('garbage'), null);
  assert.equal(dateKey(new Date(2026, 9, 27, 0, 15)), '2026-10-27');
});

test('every grade resolves to its correct source, including the shared book', () => {
  assert.equal(dataset.books.length, 7);
  for (let grade = 1; grade <= 8; grade++) assert.ok(getBook(dataset, grade).grades.includes(grade));
  assert.equal(getBook(dataset, 3), getBook(dataset, 4));
  assert.notEqual(progressKey(3, '2026-10-27'), progressKey(4, '2026-10-27'));
  assert.equal(getBook(dataset, 9), undefined);
});

test('all 2,611 source entries have continuous dates and complete provenance', async () => {
  let count = 0;
  for (const source of dataset.books) {
    await access(new URL(`../data/${source.file}`, import.meta.url));
    assert.equal(source.missingDates.length, 0);
    assert.equal(source.issues.length, 0);
    const dates = Object.keys(source.assignments);
    assert.equal(dates[0], source.startDate);
    assert.equal(dates.at(-1), source.endDate);
    assert.equal(dates.length, source.expectedDays);
    for (const [index, date] of dates.entries()) {
      const entry = source.assignments[date];
      if (index) assert.equal(shiftDay(dates[index - 1], 1), date);
      assert.ok(parseDate(date));
      assert.equal(entry.date, date);
      assert.equal(entry.source, source.file);
      assert.ok(entry.page > 0 && entry.page <= source.pageCount);
      assert.ok(entry.sourcePages.includes(entry.page));
      assert.ok(entry.copticDate);
      assert.ok(entry.originalText);
      assert.ok(!entry.originalText.includes('/f_i'));
      if (entry.prompt) assert.ok(entry.originalText.includes(entry.prompt));
      assert.ok(!entry.originalText.includes('Grade Daily Blessings 2026'));
      count++;
    }
    assert.equal(source.headingCount, source.assignmentCount + source.duplicates.length);
  }
  assert.equal(count, 2611);
});

test('October 27 assignments match all eight grades', () => {
  const expected = ['A New Name for Jacob (Genesis 35) • Pages 67-69', 'Out of Egypt (Exodus 13-15) part 3 • Pages 106-107', 'Esau & Jacob (pg. 48)', 'Esau & Jacob (pg. 48)', 'Mark 1 (verses 35 - 45)', 'Judges 7 (verses 1 - 8)', 'Psalms 111 and 112 New King James', '1 Peter 2'];
  expected.forEach((reading, index) => assert.equal(getBook(dataset, index + 1).assignments['2026-10-27'].reading, reading));
  assert.equal(getBook(dataset, 5).assignments['2026-10-27'].prompt, 'Early in the morning, our Lord Jesus woke up and departed to a solitary\nplace and did what?');
});

test('book boundaries and Holy Week retain source meaning without fabricated questions', () => {
  assert.equal(getBook(dataset, 1).assignments['2026-09-05'], undefined);
  assert.equal(getBook(dataset, 3).assignments['2026-09-26'], undefined);
  assert.equal(getBook(dataset, 5).assignments['2028-10-27'], undefined);
  const holy = getBook(dataset, 5).assignments['2027-04-26'];
  assert.equal(holy.kind, 'observance');
  assert.equal(holy.feast, '† Holy Pascha');
  assert.equal(holy.prompt, '');
  const verse = getBook(dataset, 1).assignments['2026-09-26'];
  assert.equal(verse.kind, 'verse');
  assert.ok(verse.reading.includes('(Genesis 1:26)'));
  assert.equal(verse.prompt, '');
});

test('reflection storage recovers from unavailable or invalid saved data', () => {
  assert.deepEqual(loadStorage({ getItem() { throw Error('blocked'); } }, 'key', {}), {});
  assert.deepEqual(loadStorage({ getItem: () => '{invalid' }, 'key', {}), {});
  assert.deepEqual(loadStorage({ getItem: () => 'null' }, 'key', {}), {});
});

test('source wording is safe to render and numbered questions stay intact', () => {
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  const source = getBook(dataset, 3).assignments['2026-10-27'];
  const questions = splitQuestions(source.prompt);
  assert.equal(questions.length, 2);
  assert.ok(questions[0].includes('For\nEsau'));
  assert.equal(questions[1], '2- What did Jacob give Esau to eat?');
});

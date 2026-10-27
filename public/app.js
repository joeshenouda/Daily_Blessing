import { dateKey, parseDate, shiftDay, prettyDate, escapeHtml as html, getBook, splitQuestions, progressKey, loadStorage } from './lib.js';

const icons = {
  book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',
  journal: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M3 7h4m-4 5h4m-4 5h4m4-10h5m-5 5h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  leaf: '<path d="M20 3C9 2 3 7 5 14c2 7 15 4 15-11ZM4 21 16 8"/>',
  external: '<path d="M14 3h7v7m0-7L10 14m0-11H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
const saved = loadStorage(storage, 'daily-blessings-settings', {});
const params = new URLSearchParams(location.search);
const candidateGrade = Number(params.get('grade') || saved.grade || 5);
const state = {
  grade: Number.isInteger(candidateGrade) && candidateGrade >= 1 && candidateGrade <= 8 ? candidateGrade : 5,
  date: parseDate(params.get('date')) ? params.get('date') : dateKey(),
  view: 'reading', data: null,
  progress: loadStorage(storage, 'daily-blessings-progress-v1', {}),
  calendarMonth: null,
};
if (typeof state.progress !== 'object' || Array.isArray(state.progress)) state.progress = {};
let saveTimer;
let toastTimer;

function toast(message) {
  const target = document.querySelector('#toast');
  target.textContent = message;
  target.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.classList.remove('visible'), 3500);
}

function persist(key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true; }
  catch { toast('Your browser could not save this. Keep this page open or export your journal.'); return false; }
}

function book() { return getBook(state.data, state.grade); }
function currentEntry() { return book().assignments[state.date]; }
function record(date = state.date) { return state.progress[progressKey(state.grade, date)] || {}; }
function sourceUrl(entry) { return `./data/${encodeURIComponent(entry.source)}#page=${entry.page}`; }
function updateUrl() {
  const next = new URL(location.href);
  next.searchParams.set('grade', state.grade);
  next.searchParams.set('date', state.date);
  history.replaceState(null, '', next);
  persist('daily-blessings-settings', { grade: state.grade });
}

function changeDate(value) {
  if (!parseDate(value)) return;
  flushNote();
  state.date = value;
  state.calendarMonth = value.slice(0, 7);
  state.view = 'reading';
  render();
  updateUrl();
}

function weekDates() {
  const parsed = parseDate(state.date);
  return Array.from({ length: 7 }, (_, index) => shiftDay(state.date, index - parsed.getDay()));
}

function render() {
  document.querySelector('#app').innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="./" aria-label="Daily Blessings home"><img src="./icon.svg" alt="" width="40" height="40"><span>Daily Blessings<small>A LITTLE TIME IN THE WORD</small></span></a>
      <div class="school-year"><span class="live-dot"></span>2026 – 2027 EDITION</div>
      <div class="grade-section"><label for="grade">YOUR GRADE</label><div class="select-wrap">${icon('book')}<select id="grade">${Array.from({ length: 8 }, (_, index) => `<option value="${index + 1}" ${state.grade === index + 1 ? 'selected' : ''}>Grade ${index + 1}</option>`).join('')}</select></div>${state.grade === 3 || state.grade === 4 ? '<small>Grades 3 & 4 share a reading book.</small>' : '<small>Your own journey, one day at a time.</small>'}</div>
      <nav aria-label="Main navigation">${[['reading', 'sun', 'Daily reading'], ['calendar', 'calendar', 'Reading calendar'], ['journal', 'journal', 'My journal'], ['library', 'book', 'Reading library']].map(([view, symbol, label]) => `<button data-view="${view}" class="nav-item ${state.view === view ? 'active' : ''}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(symbol)}${label}${view === 'reading' ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-quote"><span class="quote-mark">“</span><p>Your word is a lamp to my feet and a light to my path.</p><small>PSALM 119:105</small><div class="little-landscape" aria-hidden="true"><span class="landscape-sun"></span><span class="hill hill-one"></span><span class="hill hill-two"></span><span class="hill hill-three"></span></div></div>
      <div class="church"><span class="church-cross">✣</span><div>St. Mary Coptic Orthodox Church<small>East Brunswick, New Jersey</small></div></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">Your daily walk <span>/</span> <strong>${{ reading: 'Daily reading', calendar: 'Reading calendar', journal: 'My journal', library: 'Reading library' }[state.view]}</strong></div><button class="search-button" id="open-search" aria-label="Find a reading">${icon('search')}<span>Find a reading</span></button></header>
      <main id="main" tabindex="-1">
        <div class="page-heading"><div><div class="eyebrow">GROW IN FAITH, ONE DAY AT A TIME</div><h1>${{ reading: 'A little time in the Word.', calendar: 'Make room for the Word.', journal: 'A place to grow.', library: 'Your reading companions.' }[state.view]}</h1><p>${{ reading: 'Pause, read, and let God’s word be part of your day.', calendar: 'Every day is another step in your journey of faith.', journal: 'Your thoughts, your prayers, your journey through Scripture.', library: 'The original Daily Blessings books, always close at hand.' }[state.view]}</p></div><span class="heading-sprig" aria-hidden="true">${icon('leaf')}</span></div>
        ${state.view === 'reading' ? readingPage() : state.view === 'calendar' ? calendarPage() : state.view === 'journal' ? journalPage() : libraryPage()}
        <footer class="page-footer"><span>Made for a daily moment with God.</span><span>Daily Blessings · St. Mary Church · 2026–2027</span></footer>
      </main>
    </div>`;
  bindShell();
  bindPage();
}

function dateBar() {
  return `<div class="date-bar"><div class="date-nav"><button class="icon-button" id="previous-day" aria-label="Previous day">${icon('arrow', 'reverse')}</button><div class="day-heading"><span class="eyebrow">${state.date === dateKey() ? 'TODAY’S BLESSING' : prettyDate(state.date, { weekday: 'long' }).toUpperCase()}</span><h2>${prettyDate(state.date, { month: 'long', day: 'numeric' })}<span>, ${parseDate(state.date).getFullYear()}</span></h2></div><button class="icon-button" id="next-day" aria-label="Next day">${icon('arrow')}</button></div><div class="date-actions"><button class="text-button" id="today">Today</button><label class="date-picker" for="choose-date">${icon('calendar')}<span>Choose date</span><input type="date" id="choose-date" aria-label="Choose date" value="${state.date}" min="1900-01-01" max="2100-12-31"></label></div></div>`;
}

function readingPage() {
  const entry = currentEntry();
  const currentBook = book();
  const keys = Object.keys(currentBook.assignments);
  const dayNumber = keys.indexOf(state.date) + 1;
  return `${dateBar()}<div class="reading-layout"><div class="reading-column">${entry ? `<article class="reading-card"><div class="reading-card-top"><span class="grade-badge">${icon('book')} GRADE ${state.grade}</span><span class="coptic-date">${html(entry.copticDate)}</span></div><div class="reading-content"><div class="section-label">${icon('book')} ${entry.kind === 'verse' ? 'VERSE OF THE WEEK' : 'TODAY’S READING'}</div><h2 class="reading-title">${html(entry.reading.replace(/^Verse of the week:\s*/, '') || 'A day of prayer & reflection')}</h2>${entry.kind === 'verse' ? '<p class="reading-hint">Carry these words with you throughout the week.</p>' : ''}${entry.feast ? `<div class="feast"><span aria-hidden="true">✣</span><span>${html(entry.feast.replace(/^†\s*/, ''))}</span></div>` : ''}${entry.warning ? `<p class="notice">${html(entry.warning)}</p>` : ''}<div class="assignment-divider"></div><div class="section-label">${icon('leaf')} ${entry.prompt ? 'READ & REFLECT' : 'A MOMENT TO REFLECT'}</div>${entry.prompt ? `<div class="questions">${splitQuestions(entry.prompt).map((question, index) => `<div class="question"><span class="question-number">${String(index + 1).padStart(2, '0')}</span><p>${html(question.replace(/^\d{1,2}[.\-)]+\s*/, ''))}</p></div>`).join('')}</div>` : `<p class="gentle-prompt">${entry.kind === 'verse' ? 'There are no written questions for this day. Take a quiet moment with the verse above.' : 'There are no written questions in your book for this day. Take a quiet moment to read, pray, and reflect.'}</p>`}<a class="source-link" href="${sourceUrl(entry)}" target="_blank" rel="noopener">View original assignment · PDF page ${entry.page}${icon('external')}</a></div><div class="reading-card-bottom"><span>${dayNumber ? `Day ${dayNumber} of ${currentBook.assignmentCount} in your book` : ''}</span><button id="complete" class="${record().completed ? 'completed-button' : 'primary-button'}" aria-pressed="${!!record().completed}">${icon('check')}${record().completed ? 'Completed' : 'Mark as complete'}</button></div></article><section class="journal-card"><div class="journal-heading"><div>${icon('journal')}<h2>My reflection</h2></div><span id="save-state">${record().note ? 'Saved on this browser' : 'Just for you'}</span></div><label class="sr-only" for="reflection">My reflection for ${prettyDate(state.date)}</label><textarea id="reflection" placeholder="What stood out to you today? Write your answers, a thought, or a little prayer…">${html(record().note || '')}</textarea><div class="journal-bottom"><span>Your words stay on this browser.</span><button id="export-note" class="text-button">Export journal ${icon('external')}</button></div></section>` : `<section class="empty-card"><div class="empty-symbol">${icon('book')}</div><div class="eyebrow">A DIFFERENT CHAPTER</div><h2>This date is outside your book.</h2><p>Grade ${state.grade} has assignments from ${prettyDate(currentBook.startDate)} to ${prettyDate(currentBook.endDate)}. Choose a date in that range to begin.</p><button class="primary-button" data-date="${state.date < currentBook.startDate ? currentBook.startDate : currentBook.endDate}">Go to ${state.date < currentBook.startDate ? 'first' : 'last'} reading ${icon('arrow')}</button></section>`}</div><aside class="reading-aside">${calendarWidget()}${rhythmCard()}${verseCard()}</aside></div>`;
}

function calendarWidget(large = false) {
  const month = state.calendarMonth || state.date.slice(0, 7);
  const first = parseDate(`${month}-01`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: first.getDay() }, () => '<span class="calendar-blank"></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${month}-${String(day).padStart(2, '0')}`;
    const entry = book().assignments[key];
    const done = record(key).completed;
    cells.push(`<button data-date="${key}" class="calendar-day ${key === state.date ? 'selected' : ''} ${key === dateKey() ? 'is-today' : ''} ${done ? 'is-complete' : ''} ${entry ? 'has-reading' : 'no-reading'}" aria-label="${prettyDate(key)}${done ? ', completed' : entry ? ', reading available' : ', no assignment'}" ${key === state.date ? 'aria-current="date"' : ''}><span>${day}</span>${large && entry ? `<small>${html(entry.reading.replace(/^Verse of the week:\s*/, '') || 'Prayer & reflection')}</small>` : ''}${done ? '<span class="calendar-check">✓</span>' : ''}</button>`);
  }
  return `<section class="calendar-card ${large ? 'large-calendar' : ''}" aria-label="Reading calendar"><div class="calendar-title"><h2>${prettyDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h2><div><button class="icon-button small" id="previous-month" aria-label="Previous month">${icon('arrow', 'reverse')}</button><button class="icon-button small" id="next-month" aria-label="Next month">${icon('arrow')}</button></div></div><div class="calendar-grid"><div class="weekdays">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => `<span aria-label="${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}">${day}</span>`).join('')}</div>${cells.join('')}</div><div class="calendar-legend"><span><i class="legend-current"></i>Selected</span><span><i class="legend-done"></i>Completed</span>${large ? '<span><i class="legend-reading"></i>Reading available</span>' : ''}</div></section>`;
}

function rhythmCard() {
  const dates = weekDates();
  const completed = dates.filter(date => record(date).completed).length;
  return `<section class="rhythm-card"><div class="section-label">LITTLE STEPS, LASTING FAITH</div><h2>Your weekly rhythm <span>${completed}<small>/ 7</small></span></h2><div class="week-rhythm">${dates.map(date => `<button data-date="${date}" class="${record(date).completed ? 'done' : ''}" aria-label="${prettyDate(date)}, ${record(date).completed ? 'completed' : 'not completed'}"><span>${prettyDate(date, { weekday: 'narrow' })}</span><i>${record(date).completed ? icon('check') : '<span></span>'}</i></button>`).join('')}</div><p>${completed === 0 ? 'Start with today. A little time makes a difference.' : completed === 7 ? 'A beautiful week of time in the Word.' : 'You’re making room for what matters. Keep going.'}</p></section>`;
}

function verseCard() {
  const weekly = Object.values(book().assignments).filter(entry => entry.kind === 'verse' && entry.date <= state.date).at(-1);
  if (!weekly || state.date > book().endDate) return `<section class="quiet-card">${icon('leaf')}<h2>Come as you are.</h2><p>A quiet heart. An open Bible. A few moments with God.</p></section>`;
  return `<section class="verse-card"><div class="section-label">WORDS TO CARRY WITH YOU</div><p>${html(weekly.reading.replace(/^Verse of the week:\s*/, ''))}</p><button class="text-button" data-date="${weekly.date}">This week’s verse ${icon('arrow')}</button></section>`;
}

function calendarPage() {
  return `<div class="calendar-page-toolbar"><div><span class="grade-badge">GRADE ${state.grade}</span><span class="muted">${prettyDate(book().startDate)} – ${prettyDate(book().endDate)}</span></div><button class="text-button" id="today">Back to today ${icon('arrow')}</button></div>${calendarWidget(true)}`;
}

function journalPage() {
  const entries = Object.keys(book().assignments).filter(date => record(date).note || record(date).completed).sort().reverse();
  return `<div class="section-toolbar"><span>${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} for Grade ${state.grade}</span><button class="secondary-button" id="export-note">Export journal ${icon('external')}</button></div>${entries.length ? `<div class="journal-list">${entries.map(date => `<article class="journal-entry"><div><span class="eyebrow">${prettyDate(date)} ${record(date).completed ? '· COMPLETED ✓' : ''}</span><h2>${html(book().assignments[date].reading || 'Prayer & reflection')}</h2><p>${html(record(date).note || 'You made time for the Word. Your reflection is waiting for you.')}</p></div><button class="icon-button" data-date="${date}" aria-label="Open journal for ${prettyDate(date)}">${icon('arrow')}</button></article>`).join('')}</div>` : `<section class="empty-card"><div class="empty-symbol">${icon('journal')}</div><h2>Your story starts with a moment.</h2><p>Write a reflection or complete a reading, and it will appear here. Your journal is saved on this browser, separately for each grade.</p><button class="primary-button" id="today">Begin today ${icon('arrow')}</button></section>`}`;
}

function libraryPage() {
  return `<div class="library-intro">${icon('book')}<p>Original books from St. Mary Coptic Orthodox Church. Readings and questions retain the source wording; dates follow each book’s printed calendar.</p></div><div class="library-grid">${state.data.books.map(source => `<article class="book-card"><div class="book-cover"><span>ST. MARY COPTIC ORTHODOX CHURCH</span><span class="cover-cross">✣</span><h2>Daily<br>Blessings</h2><p>${source.grades.length > 1 ? 'Grades 3 & 4' : `Grade ${source.grades[0]}`}</p><small>2026 – 2027</small></div><div class="book-details"><h3>${source.grades.length > 1 ? 'Grades 3 & 4' : `Grade ${source.grades[0]}`}</h3><p>${source.assignmentCount} daily entries · ${source.pageCount} pages</p><small>${prettyDate(source.startDate)} – ${prettyDate(source.endDate)}</small><a class="source-link" href="./data/${encodeURIComponent(source.file)}" target="_blank" rel="noopener">Open reading book ${icon('external')}</a></div></article>`).join('')}</div>`;
}

function bindShell() {
  document.querySelector('#grade').addEventListener('change', event => {
    flushNote();
    state.grade = Number(event.target.value);
    state.date = dateKey();
    state.calendarMonth = state.date.slice(0, 7);
    state.view = 'reading';
    render();
    updateUrl();
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    flushNote();
    state.view = button.dataset.view;
    render();
  }));
  document.querySelector('#open-search').addEventListener('click', () => {
    document.querySelector('#search-dialog').showModal();
    document.querySelector('#search-input').focus();
    search();
  });
}

function bindPage() {
  document.querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => changeDate(button.dataset.date)));
  document.querySelector('#previous-day')?.addEventListener('click', () => changeDate(shiftDay(state.date, -1)));
  document.querySelector('#next-day')?.addEventListener('click', () => changeDate(shiftDay(state.date, 1)));
  document.querySelector('#today')?.addEventListener('click', () => changeDate(dateKey()));
  document.querySelector('#choose-date')?.addEventListener('change', event => changeDate(event.target.value));
  for (const [selector, amount] of [['#previous-month', -1], ['#next-month', 1]]) {
    document.querySelector(selector)?.addEventListener('click', () => {
      flushNote();
      const parsed = parseDate(`${state.calendarMonth || state.date.slice(0, 7)}-01`);
      parsed.setMonth(parsed.getMonth() + amount);
      state.calendarMonth = dateKey(parsed).slice(0, 7);
      render();
    });
  }
  document.querySelector('#complete')?.addEventListener('click', () => {
    flushNote();
    const previous = record();
    state.progress[progressKey(state.grade, state.date)] = { ...previous, completed: !previous.completed, updatedAt: new Date().toISOString() };
    const successful = persist('daily-blessings-progress-v1', state.progress);
    render();
    if (successful) toast(previous.completed ? 'Reading marked as not completed.' : 'A little step in faith. Reading completed.');
  });
  document.querySelector('#reflection')?.addEventListener('input', () => {
    document.querySelector('#save-state').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushNote, 400);
  });
  document.querySelector('#export-note')?.addEventListener('click', exportJournal);
}

function flushNote() {
  clearTimeout(saveTimer);
  const textarea = document.querySelector('#reflection');
  if (!textarea || textarea.value === (record().note || '')) return;
  state.progress[progressKey(state.grade, state.date)] = { ...record(), note: textarea.value, updatedAt: new Date().toISOString() };
  const successful = persist('daily-blessings-progress-v1', state.progress);
  const status = document.querySelector('#save-state');
  if (status) status.textContent = successful ? 'Saved on this browser' : 'Could not save';
}

function exportJournal() {
  flushNote();
  const entries = Object.keys(book().assignments).filter(date => record(date).note || record(date).completed).sort();
  const text = [`Daily Blessings · Grade ${state.grade} · 2026–2027`, 'St. Mary Coptic Orthodox Church', '', ...entries.flatMap(date => [prettyDate(date), book().assignments[date].reading, record(date).completed ? 'Completed' : 'In progress', '', record(date).note || '', '', '────────────────────────────────', ''])].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `daily-blessings-grade-${state.grade}-journal.txt`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function search() {
  const query = document.querySelector('#search-input').value.trim().toLowerCase();
  const container = document.querySelector('#search-results');
  if (query.length < 2) { container.innerHTML = '<p class="muted">Type at least two letters to explore your book.</p>'; return; }
  const matches = Object.values(book().assignments).filter(entry => `${entry.reading} ${entry.prompt} ${entry.feast} ${entry.date}`.toLowerCase().includes(query));
  container.innerHTML = `<p class="search-count">${matches.length} ${matches.length === 1 ? 'result' : 'results'} in Grade ${state.grade}${matches.length > 40 ? ' · showing the first 40' : ''}</p>${matches.length ? matches.slice(0, 40).map(entry => `<button class="search-result" data-result-date="${entry.date}"><small>${prettyDate(entry.date)}</small><strong>${html(entry.reading || 'Prayer & reflection')}</strong><span>${html(entry.prompt.slice(0, 130))}${entry.prompt.length > 130 ? '…' : ''}</span></button>`).join('') : '<div class="search-empty">No readings found. Try a book name or a shorter phrase.</div>'}`;
  container.querySelectorAll('[data-result-date]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('#search-dialog').close();
    changeDate(button.dataset.resultDate);
  }));
}

document.querySelector('#close-search').addEventListener('click', () => document.querySelector('#search-dialog').close());
document.querySelector('#search-input').addEventListener('input', search);
document.querySelector('#search-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
window.addEventListener('pagehide', flushNote);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushNote(); });

try {
  const response = await fetch('./assignments.json');
  if (!response.ok) throw new Error('Could not load assignments');
  state.data = await response.json();
  render();
  updateUrl();
} catch (error) {
  document.querySelector('#app').innerHTML = '<main class="loading"><h1>Your readings couldn’t load.</h1><p>Check that the local app is running, then reload this page.</p><button class="primary-button" id="reload">Try again</button></main>';
  document.querySelector('#reload').addEventListener('click', () => location.reload());
  console.error(error);
}

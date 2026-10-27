export function dateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return dateKey(parsed) === value ? parsed : null;
}

export function shiftDay(value, amount) {
  const parsed = parseDate(value);
  if (!parsed) throw new Error('Invalid calendar date');
  parsed.setDate(parsed.getDate() + amount);
  return dateKey(parsed);
}

export function prettyDate(value, options = { month: 'long', day: 'numeric', year: 'numeric' }) {
  const parsed = parseDate(value);
  return parsed ? new Intl.DateTimeFormat('en-US', options).format(parsed) : '';
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export function getBook(data, grade) {
  return data.books.find(book => book.grades.includes(Number(grade)));
}

export function splitQuestions(prompt) {
  if (!prompt) return [];
  const parts = prompt.split(/\n(?=\d{1,2}[.\-)]+\s)/);
  return parts.map(part => part.trim()).filter(Boolean);
}

export function progressKey(grade, date) {
  return `grade-${grade}:${date}`;
}

export function loadStorage(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
}

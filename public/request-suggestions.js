import { requestTextKey } from './request-text.js';

export function setupRequestSuggestions(input, list, getRequests, onSelect) {
  let options = [];
  let active = -1;
  let query = null;

  function close() {
    query = null;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function select(option) {
    input.value = option.textContent;
    onSelect();
    input.focus({ preventScroll: true });
    close();
  }

  function open(search = '') {
    if (input.readOnly) return;
    query = requestTextKey(search);
    const requests = [...getRequests()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const content = document.createDocumentFragment();
    options = [];
    const seen = new Set();
    for (const { text } of requests) {
      const key = requestTextKey(text);
      if (seen.has(key) || !key.includes(query)) continue;
      seen.add(key);
      const option = document.createElement('li');
      option.id = `request-suggestion-${options.length}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = text;
      option.addEventListener('click', () => select(option));
      options.push(option);
      content.append(option);
    }
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren(content);
    list.scrollTop = 0;
    list.hidden = options.length === 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
  }

  function showAll() {
    if (query !== '') open();
  }

  input.addEventListener('focus', showAll);
  input.addEventListener('click', showAll);
  input.addEventListener('input', () => open(input.value));
  list.addEventListener('mousedown', (event) => event.preventDefault());
  document.addEventListener('pointerdown', (event) => {
    if (!input.form.contains(event.target)) close();
  });

  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape' && !list.hidden) event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Enter' && !list.hidden && active >= 0) {
      event.preventDefault();
      select(options[active]);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (list.hidden) open();
    if (list.hidden) return;
    event.preventDefault();
    options[active]?.setAttribute('aria-selected', 'false');
    if (event.key === 'ArrowDown') active = (active + 1) % options.length;
    else active = active <= 0 ? options.length - 1 : active - 1;
    const option = options[active];
    option.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  });

  return { close, refresh: () => { if (query !== null) open(query); } };
}

import { userFromName } from './identity.js';
import { celebrateRequest } from './ingredient-confetti.js';
import { setupRequestSuggestions } from './request-suggestions.js';
import { requestTextKey } from './request-text.js';

const byId = (id) => document.getElementById(id);
const nameForm = byId('name-form');
const nameInput = byId('user-name');
const logoutButton = byId('logout-button');
const form = byId('request-form');
const input = byId('request-text');
const addButton = byId('add-button');
const ownList = byId('own-request-list');
const groups = byId('request-groups');
const viewTabs = byId('request-tabs');
const tabButtons = [...viewTabs.querySelectorAll('[role="tab"]')];
const panels = [...groups.children];
const fullDate = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'UTC' });
const todayDate = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const svgNamespace = 'http://www.w3.org/2000/svg';
const avatarColors = ['peach', 'lilac', 'sage', 'yellow'];
const userStorageKey = 'basti-eats:user-name';
const requestDraftKey = 'basti-eats:request-draft:';

let currentUser = readStoredUser();
let board;
let clock;
let requestView = 'requests';
let nextDisclosureId = 0;
const expandedGroups = new Set();
const pending = new Set();
let refreshing = false;
let revision = 0;
const suggestions = setupRequestSuggestions(input, byId('request-suggestions'), () => board?.requests ?? [], saveRequestDraft);

function readStoredUser() {
  try {
    return userFromName(localStorage.getItem(userStorageKey));
  } catch {
    return null;
  }
}

function restoreRequestDraft() {
  input.value = '';
  if (!currentUser) return;
  try {
    input.value = localStorage.getItem(requestDraftKey + currentUser.id) ?? '';
  } catch {
    // A browser storage error still allows entering a request.
  }
}

function saveRequestDraft() {
  if (!currentUser) return;
  try {
    localStorage.setItem(requestDraftKey + currentUser.id, input.value);
  } catch {
    // A browser storage error still allows submitting the request.
  }
}

function setCurrentUser(user) {
  announce('');
  currentUser = user;
  requestView = 'requests';
  expandedGroups.clear();
  announce('');
  nameForm.reset();
  restoreRequestDraft();
  suggestions.close();
  renderView();
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function icon(name) {
  const svg = document.createElementNS(svgNamespace, 'svg');
  const use = document.createElementNS(svgNamespace, 'use');
  svg.classList.add('icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}

function historyView() {
  return location.hash === '#history';
}

function formatDay(day, formatter = fullDate) {
  return formatter.format(new Date(`${day}T12:00:00Z`));
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'request' : 'requests'}`;
}

function announce(message, visible = false) {
  const notice = byId(currentUser ? 'notice' : 'name-notice');
  notice.classList.toggle('sr-only', !visible);
  notice.textContent = message;
}

async function api(method, body) {
  const response = await fetch('/api/board', {
    method,
    credentials: 'omit',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not reach the request board.');
  return data;
}

function renderControls() {
  logoutButton.disabled = pending.size > 0;
  addButton.disabled = !currentUser || pending.has('add');
  for (const button of groups.querySelectorAll('button[data-payment]')) {
    button.setAttribute('aria-disabled', String(pending.has('payment')));
  }
  for (const button of ownList.querySelectorAll('button[data-remove-request]')) {
    button.setAttribute('aria-disabled', String(pending.has('remove')));
  }
}

function paymentBadge({ day, userId, userName }, paid) {
  const own = currentUser.id === userId;
  const badge = document.createElement(own ? 'button' : 'span');
  badge.className = `payment-badge${paid ? ' paid' : ''}`;

  if (own || paid) {
    const indicator = textElement('span', 'status-icon', '');
    indicator.setAttribute('aria-hidden', 'true');
    if (paid) indicator.append(icon('check'));
    badge.append(indicator);
  }
  badge.append(paid ? 'Paid' : 'Unpaid');

  if (own) {
    badge.type = 'button';
    badge.dataset.payment = `${day}:${userId}`;
    badge.setAttribute('aria-label', `Paid status for ${userName} on ${formatDay(day)}`);
    badge.setAttribute('aria-pressed', String(paid));
    badge.title = paid ? 'Mark this order as unpaid' : 'Mark this order as paid';
    badge.addEventListener('click', () => savePayment(day, !paid));
  }
  return badge;
}

function requesterAvatar(item) {
  const color = avatarColors[item.userId.codePointAt(0) % avatarColors.length] ?? '';
  const initial = (Array.from(item.userName)[0] ?? '').toUpperCase();
  const avatar = textElement('span', `avatar ${color}`, initial);
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

function requestList(items, { removable = false } = {}) {
  const list = textElement('ul', 'request-list', '');
  list.setAttribute('role', 'list');
  for (const item of items) {
    const row = textElement('li', 'request-row', '');
    const time = textElement('time', 'request-byline', clock.format(new Date(item.createdAt)));
    time.dateTime = item.createdAt;
    const label = textElement('div', 'request-entry', '');
    label.append(textElement('strong', 'request-text', item.text), time);
    row.append(label);
    if (removable) {
      const remove = textElement('button', 'remove-request', '');
      remove.type = 'button';
      remove.dataset.removeRequest = item.id;
      remove.setAttribute('aria-label', `Remove ${item.text}`);
      remove.title = 'Remove request';
      remove.append(icon('trash'));
      remove.addEventListener('click', () => removeRequest(item));
      row.append(remove);
    }
    list.append(row);
  }
  return list;
}

function groupBy(items, keyFor) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function requestGroup(key, label, content, status) {
  const row = textElement('li', 'request-group', '');
  const summary = textElement('div', 'group-summary', '');
  const toggle = textElement('button', 'group-toggle', '');
  toggle.type = 'button';
  toggle.dataset.group = key;
  const chevron = icon('chevron');
  chevron.classList.add('group-chevron');
  const details = textElement('div', 'group-details', '');
  details.id = `group-details-${nextDisclosureId++}`;
  toggle.setAttribute('aria-controls', details.id);
  if (status) {
    const heading = textElement('div', 'payment-group-label', '');
    heading.id = `${details.id}-label`;
    heading.append(...label);
    toggle.classList.add('group-toggle-icon');
    toggle.setAttribute('aria-labelledby', heading.id);
    toggle.append(chevron);
    heading.addEventListener('click', () => {
      toggle.focus({ preventScroll: true });
      toggle.click();
    });
    summary.append(heading, status, toggle);
  } else {
    toggle.append(...label, chevron);
    summary.append(toggle);
  }
  details.append(content);
  row.append(summary, details);

  function setExpanded(expanded) {
    details.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    if (expanded) expandedGroups.add(key);
    else expandedGroups.delete(key);
  }
  setExpanded(expandedGroups.has(key));
  toggle.addEventListener('click', () => setExpanded(details.hidden));
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || details.hidden) return;
    event.preventDefault();
    setExpanded(false);
    toggle.focus();
  });
  return row;
}

function orderGroups(items) {
  const list = textElement('ul', 'group-list', '');
  list.setAttribute('role', 'list');
  const orders = groupBy(items, (item) => requestTextKey(item.text));
  for (const [key, requests] of orders) {
    const people = textElement('ul', 'group-people', '');
    people.setAttribute('role', 'list');
    for (const personRequests of groupBy(requests, (item) => item.userId).values()) {
      const person = textElement('li', '', '');
      person.append(textElement('span', '', personRequests[0].userName));
      if (personRequests.length > 1) person.append(textElement('span', 'group-quantity', `×${personRequests.length}`));
      people.append(person);
    }
    const title = textElement('strong', 'request-text group-title', requests[0].text);
    const quantity = textElement('span', 'group-quantity', `×${requests.length}`);
    list.append(requestGroup(`requests:${requests[0].day}:${key}`, [title, quantity], people));
  }
  return list;
}

function paymentGroups(items) {
  const list = textElement('ul', 'group-list', '');
  list.setAttribute('role', 'list');
  for (const [userId, requests] of groupBy(items, (item) => item.userId)) {
    const order = requests[0];
    const paid = requests.every((request) => request.paid);
    const title = textElement('strong', 'request-text group-title', order.userName);
    const label = [requesterAvatar(order), title];
    list.append(requestGroup(`payments:${order.day}:${userId}`, label, requestList(requests), paymentBadge(order, paid)));
  }
  return list;
}

function renderRequests(items, history) {
  const focused = document.activeElement;
  const focusedPayment = focused?.dataset.payment;
  const focusedGroup = focused?.dataset.group;
  const activePanel = byId(`${requestView}-panel`);
  const renderGroups = requestView === 'payments' ? paymentGroups : orderGroups;
  for (const panel of panels) {
    panel.hidden = panel !== activePanel;
    panel.replaceChildren();
  }
  if (!items.length) {
    activePanel.append(textElement('div', 'empty-state', history ? 'No past requests yet.' : 'No requests for today yet.'));
  } else if (history) {
    for (const [day, requests] of groupBy(items, (item) => item.day)) {
      const group = textElement('section', 'day-group', '');
      const heading = textElement('div', 'day-heading', '');
      heading.append(textElement('h3', '', formatDay(day)), textElement('span', 'request-count', countLabel(requests.length)));
      group.append(heading, renderGroups(requests));
      activePanel.append(group);
    }
  } else {
    activePanel.append(renderGroups(items));
  }

  if (focusedPayment) activePanel.querySelector(`button[data-payment="${CSS.escape(focusedPayment)}"]`)?.focus();
  if (focusedGroup) activePanel.querySelector(`button[data-group="${CSS.escape(focusedGroup)}"]`)?.focus();
}

function renderView() {
  const signedIn = Boolean(currentUser);
  byId('welcome').hidden = signedIn;
  byId('topbar').hidden = !signedIn;
  byId('navigation').hidden = !signedIn;
  byId('board-view').hidden = !signedIn;
  const profileName = byId('profile-name');
  profileName.textContent = currentUser?.name ?? '';
  profileName.title = currentUser?.name ?? '';
  if (!signedIn) {
    suggestions.close();
    renderControls();
    return;
  }

  const history = historyView();
  if (history) suggestions.close();
  byId('board-heading').hidden = !history && !board;
  byId('history-title').hidden = !history;
  byId('composer').hidden = history;
  byId('today-heading').hidden = history;
  viewTabs.hidden = !board;
  for (const tab of tabButtons) {
    const selected = tab.dataset.view === requestView;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  byId('page-date').hidden = history || !board;
  byId('startup').hidden = Boolean(board);
  byId('requests').hidden = !board;
  byId(history ? 'today-link' : 'history-link').removeAttribute('aria-current');
  byId(history ? 'history-link' : 'today-link').setAttribute('aria-current', 'page');
  if (!board) {
    renderControls();
    return;
  }

  byId('date-label').textContent = formatDay(board.today, todayDate);
  const items = board.requests.filter((item) => history ? item.day < board.today : item.day === board.today)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ownRequests = history ? [] : items.filter((item) => item.userId === currentUser.id);
  const focusedRemoval = document.activeElement?.dataset.removeRequest;
  byId('own-requests').hidden = ownRequests.length === 0;
  if (ownRequests.length) ownList.replaceChildren(requestList(ownRequests, { removable: true }));
  else ownList.replaceChildren();
  if (focusedRemoval) ownList.querySelector(`button[data-remove-request="${CSS.escape(focusedRemoval)}"]`)?.focus();
  const count = byId('request-count');
  count.textContent = countLabel(items.length);
  count.hidden = false;
  renderRequests(items, history);
  renderControls();
}

async function refresh() {
  if (refreshing || pending.size) return;
  refreshing = true;
  const started = revision;
  try {
    const next = await api('GET');
    if (started !== revision || JSON.stringify(next) === JSON.stringify(board)) return;
    if (!board || board.timeZone !== next.timeZone) {
      clock = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: next.timeZone });
    }
    board = next;
    renderView();
    suggestions.refresh();
  } catch {
    if (board) return;
    const retry = textElement('button', 'retry-button', 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', refresh);
    byId('startup').replaceChildren('Could not load requests.', retry);
  } finally {
    refreshing = false;
    byId('requests').setAttribute('aria-busy', 'false');
    if (!board && started !== revision) refresh();
  }
}

async function change(kind, operation) {
  if (pending.has(kind)) return;
  pending.add(kind);
  revision += 1;
  renderControls();
  announce('');
  try {
    await operation();
  } catch (error) {
    announce(error.name === 'TimeoutError' ? 'The board took too long to respond. Try again.' : error.message, true);
  } finally {
    pending.delete(kind);
    renderControls();
    if (!board) refresh();
  }
}

nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const user = userFromName(nameInput.value);
  if (!user) {
    announce('Enter your name first.', true);
    nameInput.focus();
    return;
  }
  try {
    localStorage.setItem(userStorageKey, user.name);
  } catch {
    announce('Could not save your name in this browser.', true);
    return;
  }
  if (historyView()) window.history.replaceState(window.history.state, '', '#today');
  setCurrentUser(user);
  byId('profile-name').focus();
});

logoutButton.addEventListener('click', () => {
  try {
    localStorage.removeItem(userStorageKey);
  } catch {
    announce('Could not clear your saved name in this browser.', true);
    return;
  }
  setCurrentUser(null);
  nameInput.focus();
});

input.addEventListener('input', saveRequestDraft);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const text = input.value.trim();
  if (!text) {
    announce('Enter a food request first.', true);
    input.focus();
    return;
  }
  change('add', async () => {
    saveRequestDraft();
    input.readOnly = true;
    suggestions.close();
    try {
      const { request } = await api('POST', { text, name: currentUser.name });
      if (board) {
        board.requests.push(request);
        if (request.day > board.today) board.today = request.day;
      }
      renderView();
      announce('Request added.', !board);
      celebrateRequest(addButton);
      if (!historyView() && document.activeElement === document.body) input.focus();
    } finally {
      input.readOnly = false;
    }
  });
});

function removeRequest(item) {
  if (currentUser?.id !== item.userId || item.day !== board?.today) return;
  change('remove', async () => {
    const { id } = await api('DELETE', { id: item.id, name: currentUser.name });
    const restoreFocus = document.activeElement?.dataset.removeRequest === id;
    board.requests = board.requests.filter((request) => request.id !== id);
    renderView();
    suggestions.refresh();
    announce('Request removed.');
    if (restoreFocus && currentUser && !historyView()) {
      (ownList.querySelector('button[data-remove-request]') ?? addButton).focus();
    }
  });
}

function savePayment(day, paid) {
  if (!currentUser) return;
  change('payment', async () => {
    const result = await api('PATCH', { day, paid, name: currentUser.name });
    const updated = new Set(result.requestIds);
    for (const request of board.requests) {
      if (updated.has(request.id)) request.paid = result.paid;
    }
    renderView();
    announce(result.paid ? 'Order marked as paid.' : 'Order marked as unpaid.');
  });
}

for (const tab of tabButtons) {
  tab.addEventListener('click', () => {
    if (requestView === tab.dataset.view) return;
    requestView = tab.dataset.view;
    renderView();
  });
}
viewTabs.addEventListener('keydown', (event) => {
  const index = tabButtons.indexOf(event.target);
  if (index < 0) return;
  let next;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = tabButtons[1 - index];
  else if (event.key === 'Home') next = tabButtons[0];
  else if (event.key === 'End') next = tabButtons[tabButtons.length - 1];
  else return;
  event.preventDefault();
  next.focus();
  next.click();
});

window.addEventListener('storage', (event) => {
  if (event.storageArea !== localStorage || (event.key !== null && event.key !== userStorageKey)) return;
  const user = readStoredUser();
  if (user?.name !== currentUser?.name) setCurrentUser(user);
});
window.addEventListener('hashchange', () => {
  announce('');
  renderView();
  window.scrollTo(0, 0);
});
window.addEventListener('focus', refresh);
window.setInterval(refresh, 30_000);
restoreRequestDraft();
renderView();
refresh();

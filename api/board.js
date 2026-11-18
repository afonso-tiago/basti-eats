import { randomUUID } from 'node:crypto';
import { userFromName } from '../public/identity.js';
import { boardDay, timeZone } from '../server/board.js';
import { getStore } from '../server/storage.js';

const maxRequestLength = 240;

function json(data, status = 200, headers) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function present(item) {
  const userName = item.userName ?? item.userId.replace(/^./u, (character) => character.toUpperCase());
  return { ...item, userName, day: boardDay(new Date(item.createdAt)) };
}

export async function handleBoard(request) {
  const { method } = request;

  try {
    if (method === 'GET') {
      const requests = (await getStore().list()).map(present);
      return json({ today: boardDay(), timeZone, requests });
    }

    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' });
    }

    let body;
    try {
      body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an object.');
    } catch {
      return json({ error: 'Send a valid JSON object.' }, 400);
    }

    const currentUser = userFromName(body.name);
    if (!currentUser) return json({ error: 'Enter your name first.' }, 403);

    if (method === 'POST') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > maxRequestLength) {
        return json({ error: `Enter a request between 1 and ${maxRequestLength} characters.` }, 400);
      }
      const item = {
        id: randomUUID(), userId: currentUser.id, userName: currentUser.name,
        text, paid: false, createdAt: new Date().toISOString(),
      };
      await getStore().add(item);
      return json({ request: present(item) }, 201);
    }

    if (method === 'DELETE') {
      const { id } = body;
      if (typeof id !== 'string' || !id.trim()) return json({ error: 'Choose a request to remove.' }, 400);

      const store = getStore();
      const item = await store.get(id);
      if (item) {
        if (item.userId !== currentUser.id) return json({ error: 'You can only remove your own requests.' }, 403);
        if (boardDay(new Date(item.createdAt)) !== boardDay()) {
          return json({ error: 'You can only remove requests from today.' }, 403);
        }
        await store.remove(id);
      }
      return json({ id });
    }

    const { day, paid } = body;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof paid !== 'boolean') {
      return json({ error: 'Choose a date and its payment status.' }, 400);
    }
    const store = getStore();
    const items = await store.list();
    const requestIds = items.filter((item) => item.userId === currentUser.id && boardDay(new Date(item.createdAt)) === day)
      .map((item) => item.id);
    if (!requestIds.length) return json({ error: 'You have no requests on this date.' }, 404);
    // A later addition remains unpaid, even if it arrives while this payment is being saved.
    await store.pay(requestIds, paid);
    return json({ requestIds, paid });
  } catch (error) {
    console.error('Board storage error:', error.message);
    return json({ error: 'Could not reach the request board. Try again in a moment.' }, 503);
  }
}

export default { fetch: handleBoard };

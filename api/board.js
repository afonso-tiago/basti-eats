import { randomUUID } from 'node:crypto';
import { maxNameLength, userFromName } from '../public/identity.js';
import { maxRequestLength } from '../public/request-text.js';
import { boardDay, timeZone } from '../server/board.js';
import { getStore } from '../server/storage.js';

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
      return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET, POST, PATCH, DELETE' });
    }

    let body;
    try {
      body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an object.');
    } catch {
      return json({ error: 'Sende ein gültiges JSON-Objekt.' }, 400);
    }

    const currentUser = userFromName(body.name);
    if (!currentUser) return json({ error: 'Gib zuerst deinen Namen ein.' }, 403);
    if (currentUser.name.length > maxNameLength) {
      return json({ error: `Der Name darf höchstens ${maxNameLength} Zeichen lang sein.` }, 400);
    }

    if (method === 'POST') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > maxRequestLength) {
        return json({ error: `Gib eine Bestellung mit 1 bis ${maxRequestLength} Zeichen ein.` }, 400);
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
      if (typeof id !== 'string' || !id.trim()) return json({ error: 'Wähle eine Bestellung zum Entfernen aus.' }, 400);

      const store = getStore();
      const item = await store.get(id);
      if (item) {
        if (item.userId !== currentUser.id) return json({ error: 'Du kannst nur deine eigenen Bestellungen entfernen.' }, 403);
        if (boardDay(new Date(item.createdAt)) !== boardDay()) {
          return json({ error: 'Du kannst nur Bestellungen von heute entfernen.' }, 403);
        }
        await store.remove(id);
      }
      return json({ id });
    }

    const { day, paid } = body;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof paid !== 'boolean') {
      return json({ error: 'Wähle ein Datum und einen Zahlungsstatus aus.' }, 400);
    }
    const store = getStore();
    const items = await store.list();
    const requestIds = items.filter((item) => item.userId === currentUser.id && boardDay(new Date(item.createdAt)) === day)
      .map((item) => item.id);
    if (!requestIds.length) return json({ error: 'Du hast an diesem Tag keine Bestellungen.' }, 404);
    // A later addition remains unpaid, even if it arrives while this payment is being saved.
    await store.pay(requestIds, paid);
    return json({ requestIds, paid });
  } catch (error) {
    console.error('Board storage error:', error.message);
    return json({ error: 'Die Bestellübersicht ist gerade nicht erreichbar. Versuche es gleich noch einmal.' }, 503);
  }
}

export default { fetch: handleBoard };

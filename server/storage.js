import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { userFromName } from '../public/identity.js';
import { boardDay } from './board.js';

const redisKey = 'basti-eats:requests:v1';
const setPayment = `
  local updates = {}
  for index = 2, #ARGV do
    local id = ARGV[index]
    local raw = redis.call('HGET', KEYS[1], id)
    if raw then
      local item = cjson.decode(raw)
      item.paid = ARGV[1] == 'true'
      updates[#updates + 1] = id
      updates[#updates + 1] = cjson.encode(item)
    end
  end
  if #updates == 0 then return 0 end
  return redis.call('HSET', KEYS[1], unpack(updates))
`;

function redisStore(url, token) {
  async function command(...args) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
    const { result, error } = await response.json();
    if (!response.ok || error) throw new Error(`Redis command ${args[0]} failed (${response.status})`);
    return result;
  }

  return {
    async list() {
      return (await command('HVALS', redisKey)).map((item) => JSON.parse(item));
    },
    async get(id) {
      const item = await command('HGET', redisKey, id);
      return item === null ? null : JSON.parse(item);
    },
    async add(item) {
      await command('HSET', redisKey, item.id, JSON.stringify(item));
    },
    async remove(id) {
      await command('HDEL', redisKey, id);
    },
    async pay(requestIds, paid) {
      await command('EVAL', setPayment, 1, redisKey, String(paid), ...requestIds);
    },
  };
}

function demoRequests() {
  const now = Date.now();
  const today = boardDay(new Date(now));
  const minute = 60_000;
  const past = now - 26 * 60 * minute;
  function minutesAgo(minutes) {
    const timestamp = now - minutes * minute;
    return boardDay(new Date(timestamp)) === today ? timestamp : now;
  }
  const sample = [
    ['Basti', 'Spicy chicken bowl, extra avocado', false, minutesAgo(18)],
    ['Alex', 'Margherita pizza with a side salad', true, minutesAgo(26)],
    ['Sam', 'Falafel wrap, no onions', false, minutesAgo(38)],
    ['Kim', 'Miso ramen with extra mushrooms', true, minutesAgo(52)],
    ['Alex', 'Veggie burrito with guacamole', true, past],
    ['Basti', 'Chicken katsu curry', true, past - 15 * minute],
  ];
  return sample.map(([userName, text, paid, date]) => ({
    id: randomUUID(), userId: userFromName(userName).id, userName, text, paid, createdAt: new Date(date).toISOString(),
  }));
}

function localStore(file) {
  function write(items) {
    mkdirSync(dirname(file), { recursive: true });
    const temporaryFile = `${file}.${process.pid}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify(items, null, 2));
    renameSync(temporaryFile, file);
  }

  function list() {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const items = demoRequests();
      write(items);
      return items;
    }
  }

  return {
    list,
    get(id) {
      return list().find((item) => item.id === id);
    },
    add(item) {
      write([...list(), item]);
    },
    remove(id) {
      write(list().filter((item) => item.id !== id));
    },
    pay(requestIds, paid) {
      const selected = new Set(requestIds);
      const items = list();
      for (const item of items) {
        if (selected.has(item.id)) item.paid = paid;
      }
      write(items);
    },
  };
}

export function getStore() {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token, VERCEL, NODE_ENV, BOARD_DATA_FILE } = process.env;
  if (url && token) return redisStore(url, token);
  if (url || token || VERCEL || NODE_ENV === 'production') {
    throw new Error('Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
  return localStore(resolve(BOARD_DATA_FILE || '.data/requests.json'));
}

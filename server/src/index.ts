import { Hono } from 'hono';
import { cors } from 'hono/cors';

export { Room } from './room';

interface Env {
  ROOM: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for the frontend
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

/** Create a new room */
app.post('/api/rooms', async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  const id = c.env.ROOM.newUniqueId();
  const stub = c.env.ROOM.get(id);

  const res = await stub.fetch(new Request('https://room/init', {
    method: 'POST',
    body: JSON.stringify({ name: body.name || 'Untitled Room' }),
    headers: { 'Content-Type': 'application/json' },
  }));

  const data = await res.json() as any;

  // Return the room ID (durable object ID hex) and tokens
  return c.json({
    roomId: id.toString(),
    ...data,
  });
});

/** Get room info (public - no token needed) */
app.get('/api/rooms/:roomId/info', async (c) => {
  const roomId = c.req.param('roomId');
  try {
    const id = c.env.ROOM.idFromString(roomId);
    const stub = c.env.ROOM.get(id);
    const res = await stub.fetch(new Request('https://room/info'));
    if (!res.ok) {
      return c.json({ error: await res.text() }, res.status as any);
    }
    return c.json(await res.json());
  } catch {
    return c.json({ error: 'Room not found' }, 404);
  }
});

/** WebSocket connection to a room */
app.get('/api/rooms/:roomId/ws', async (c) => {
  const roomId = c.req.param('roomId');
  const upgradeHeader = c.req.header('Upgrade');

  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }

  try {
    const id = c.env.ROOM.idFromString(roomId);
    const stub = c.env.ROOM.get(id);
    return stub.fetch(new Request('https://room/ws', {
      headers: c.req.raw.headers,
    })) as any;
  } catch {
    return c.text('Room not found', 404);
  }
});

/** Health check */
app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;

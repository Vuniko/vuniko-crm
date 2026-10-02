import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  results: [] as unknown[],
  tasks: [] as Array<() => Promise<void>>,
  pipeline: vi.fn(),
  ai: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
  after: (task: () => Promise<void>) => mocks.tasks.push(task),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const result = mocks.results.shift();
      const chain: Record<string, unknown> = {};
      for (const method of [
        'select',
        'eq',
        'insert',
        'update',
        'order',
        'maybeSingle',
        'single',
      ]) {
        chain[method] = () => chain;
      }
      chain.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result).then(resolve);
      return chain;
    },
  }),
}));
vi.mock('@/lib/ai/auto-reply', () => ({ dispatchInboundToAiReply: mocks.ai }));
vi.mock('@/lib/web-chat/pipeline', () => ({
  syncLeadToPipeline: mocks.pipeline,
}));
vi.mock('@/lib/web-chat/intent', () => ({
  saveLeadIntent: async () => ({ intent: 'price' }),
}));
vi.mock('@/lib/web-chat/booking', () => ({
  advanceBookingRequest: async () => ({ active: false }),
}));
vi.mock('@/lib/web-chat/lead-capture', () => ({
  captureConversationalLead: async () => ({}),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ success: true }),
  rateLimitResponse: vi.fn(),
}));
vi.mock('@/lib/web-chat/realtime', () => ({
  broadcastWebChatMessage: mocks.broadcast,
  webChatRealtimeTopic: () => 'signed-topic',
}));
import { POST } from './route';

beforeEach(() => {
  mocks.tasks.length = 0;
  mocks.results.length = 0;
  mocks.pipeline.mockReset();
  mocks.ai.mockReset();
});

it('returns saved catalog messages and subscription details without waiting for CRM bookkeeping', async () => {
  const message = {
    id: 'customer-1',
    sender_type: 'customer',
    content_text: 'Precios',
    created_at: '2026-10-02T12:00:00Z',
  };
  const reply = {
    id: 'bot-1',
    sender_type: 'bot',
    content_text: 'Corte — S/ 20',
    created_at: '2026-10-02T12:00:01Z',
  };
  mocks.results.push(
    { data: { id: 'widget', account_id: 'account', is_enabled: true } },
    {
      data: {
        id: 'visitor',
        contact_id: 'contact',
        conversation_id: 'conversation',
      },
    },
    { data: message },
    { data: null },
    { data: [{ name: 'Corte', price: 20, duration_minutes: 30 }] },
    { data: reply },
    { data: null },
    { data: { owner_user_id: 'owner' } }
  );
  const response = await POST(
    new Request('https://example.test/api/web-chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        widgetKey: 'widget',
        text: 'Precios',
        visitorToken: 'visitor-token',
      }),
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    message,
    replies: [reply],
    realtimeTopic: 'signed-topic',
    visitorToken: 'visitor-token',
  });
  expect(mocks.pipeline).not.toHaveBeenCalled();
  expect(mocks.ai).not.toHaveBeenCalled();
  expect(mocks.tasks).toHaveLength(1);
  await mocks.tasks[0]();
  expect(mocks.pipeline).toHaveBeenCalledOnce();
  expect(mocks.results).toHaveLength(0);
});

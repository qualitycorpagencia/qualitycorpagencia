import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';

const PRICE = 62;
const ORIGIN = 'https://confraternizacaostnb2026.netlify.app';
const BASE = String(process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3').replace(/\/$/, '');

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function clean(value, max = 60) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, max);
}
function secureEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}
function getDb(context) {
  const deploymentContext = (context && context.deploy && context.deploy.context) || process.env.CONTEXT || 'production';
  const name = deploymentContext === 'production' ? 'stnb-confraternizacao-2026' : 'stnb-preview-' + clean(deploymentContext);
  return getStore(name);
}
async function readJson(store, key) {
  try { return await store.get(key, { type: 'json' }); } catch { return null; }
}
const writeJson = (store, key, value) => store.setJSON(key, value);

async function register(req, store) {
  if (req.method !== 'POST') return respond({ ok: false, error: 'Método não permitido' }, 405);
  const apiKey = String(Netlify.env.get('ASAAS_API_KEY') || process.env.ASAAS_API_KEY || '').trim();
  if (!apiKey) return respond({ ok: false, error: 'Checkout temporariamente indisponível' }, 503);
  try {
    const data = await req.json();
    const id = clean(data.inscricao_id);
    const nome = String(data.nome || '').trim();
    const whatsapp = String(data.whatsapp || '').trim();
    const turma = String(data.turma || '').trim();
    const adultos = Number(data.adultos || 0);
    const criancas = Number(data.criancas || 0);
    const phoneDigits = whatsapp.replace(/\D/g, '');
    const phone = phoneDigits ? (phoneDigits.startsWith('55') ? phoneDigits : '55' + phoneDigits) : '';
    if (!id || !nome || !phone || !turma || data.ciencia !== 'sim' ||
        !Number.isInteger(adultos) || adultos < 1 || adultos > 20 ||
        !Number.isInteger(criancas) || criancas < 0 || criancas > 20) {
      return respond({ ok: false, error: 'Confira os dados obrigatórios da inscrição' }, 400);
    }

    const regKey = 'inscricoes/' + id;
    const checkoutKey = 'checkouts/' + id;
    const previous = await readJson(store, regKey);
    if (previous && previous.status_pagamento === 'pago') return respond({ ok: false, error: 'Esta inscrição já está paga' }, 409);
    const total = adultos * PRICE;
    const oldCheckout = await readJson(store, checkoutKey);
    const age = Date.now() - Date.parse((oldCheckout && oldCheckout.criado_em) || '');
    if (oldCheckout && oldCheckout.provedor === 'asaas' && Number(oldCheckout.valor_total) === total &&
        oldCheckout.checkout_url && Number.isFinite(age) && age < 22 * 60 * 60 * 1000) {
      return respond({ ok: true, id, total, checkout_url: oldCheckout.checkout_url, provedor: 'asaas', reutilizado: true });
    }

    const registration = Object.assign({}, previous || {}, {
      inscricao_id: id, nome, whatsapp, turma, adultos, criancas,
      acompanhantes: Array.isArray(data.acompanhantes) ? data.acompanhantes : [],
      criancas_detalhes: Array.isArray(data.criancas_detalhes) ? data.criancas_detalhes : [],
      observacoes: String(data.observacoes || '').trim(),
      valor_total: total, provedor_pagamento: 'asaas',
      status_pagamento: (previous && previous.status_pagamento) || 'pendente',
      ciencia: 'sim', criado_em: (previous && previous.criado_em) || new Date().toISOString()
    });
    await writeJson(store, regKey, registration);

    const callback = ORIGIN + '/pagamento-concluido/?inscricao_id=' + encodeURIComponent(id);
    const payload = {
      billingTypes: ['PIX', 'CREDIT_CARD'], chargeTypes: ['DETACHED'], minutesToExpire: 1440,
      externalReference: id,
      callback: { successUrl: callback, cancelUrl: callback + '&resultado=cancelado', expiredUrl: callback + '&resultado=expirado' },
      items: [{
        name: 'Confraternização STNB Polo Campinas 2026',
        description: adultos + ' adulto(s) inscrito(s) no churrasco STNB Polo Campinas 2026',
        quantity: adultos, value: PRICE
      }],
      customerData: { name: nome, phone }
    };
    const apiResponse = await fetch(BASE + '/checkouts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', access_token: apiKey }, body: JSON.stringify(payload)
    });
    const result = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok || !result.id) {
      console.error('asaas_checkout_error', apiResponse.status, 'checkout rejected');
      return respond({ ok: false, error: 'Não foi possível gerar o checkout agora. Tente novamente.' }, 502);
    }

    const checkoutUrl = 'https://asaas.com/checkoutSession/show?id=' + encodeURIComponent(result.id);
    await writeJson(store, checkoutKey, {
      inscricao_id: id, checkout_id: result.id, checkout_url: checkoutUrl, valor_total: total,
      provedor: 'asaas', status_checkout: 'ACTIVE', criado_em: new Date().toISOString()
    });
    await writeJson(store, 'asaas-checkout-ids/' + clean(result.id), { inscricao_id: id, checkout_id: result.id });
    return respond({ ok: true, id, total, checkout_url: checkoutUrl, provedor: 'asaas' });
  } catch (error) {
    console.error('registration_error', error && error.message || 'unknown');
    return respond({ ok: false, error: 'Não foi possível concluir a inscrição' }, 500);
  }
}

async function status(req, store) {
  if (req.method !== 'GET') return respond({ ok: false, error: 'Método não permitido' }, 405);
  const url = new URL(req.url);
  const id = clean(url.searchParams.get('inscricao_id') || url.searchParams.get('id'));
  if (!id) return respond({ ok: false, error: 'Inscrição inválida' }, 400);
  const reg = await readJson(store, 'inscricoes/' + id);
  if (!reg) return respond({ ok: false, error: 'Inscrição não encontrada' }, 404);
  return respond({
    ok: true, inscricao_id: id, status_pagamento: String(reg.status_pagamento || 'pendente'),
    provedor_pagamento: String(reg.provedor_pagamento || ''),
    atualizado_em: reg.pagamento && reg.pagamento.atualizado_em || null
  });
}

async function webhook(req, store) {
  if (req.method !== 'POST') return respond({ ok: false, error: 'Método não permitido' }, 405);
  const token = String(Netlify.env.get('ASAAS_WEBHOOK_TOKEN') || process.env.ASAAS_WEBHOOK_TOKEN || '');
  if (!token || !secureEqual(req.headers.get('asaas-access-token'), token)) return respond({ ok: false, error: 'Não autorizado' }, 401);
  try {
    const event = await req.json();
    const eventId = clean(event.id, 120);
    const name = String(event.event || '').toUpperCase();
    const checkoutId = String(event.checkout && event.checkout.id || '');
    if (!eventId || !checkoutId) return respond({ ok: false, error: 'Evento inválido' }, 400);
    const eventKey = 'asaas-webhook-events/' + eventId;
    if (await readJson(store, eventKey)) return respond({ ok: true, duplicate: true });

    const mapping = await readJson(store, 'asaas-checkout-ids/' + clean(checkoutId));
    const id = clean((event.checkout && event.checkout.externalReference) || (mapping && mapping.inscricao_id));
    if (!id || (mapping && mapping.inscricao_id && mapping.inscricao_id !== id)) return respond({ ok: false, error: 'Inscrição não encontrada' }, 404);
    const regKey = 'inscricoes/' + id;
    const checkoutKey = 'checkouts/' + id;
    const reg = await readJson(store, regKey);
    const checkout = await readJson(store, checkoutKey);
    if (!reg || !checkout || checkout.checkout_id !== checkoutId) return respond({ ok: false, error: 'Checkout não encontrado' }, 404);

    const statuses = { CHECKOUT_PAID: 'pago', CHECKOUT_CANCELED: 'cancelado', CHECKOUT_EXPIRED: 'expirado' };
    const next = statuses[name];
    if (next && !(reg.status_pagamento === 'pago' && next !== 'pago')) {
      reg.status_pagamento = next;
      reg.provedor_pagamento = 'asaas';
      reg.pagamento = {
        provedor: 'asaas', evento: name, evento_id: eventId, checkout_id: checkoutId,
        atualizado_em: new Date().toISOString()
      };
      await writeJson(store, regKey, reg);
      checkout.status_checkout = next === 'pago' ? 'PAID' : next.toUpperCase();
      checkout.atualizado_em = new Date().toISOString();
      await writeJson(store, checkoutKey, checkout);
    }
    await writeJson(store, eventKey, {
      event_id: eventId, event: name, checkout_id: checkoutId, inscricao_id: id, recebido_em: new Date().toISOString()
    });
    return respond({ ok: true });
  } catch (error) {
    console.error('asaas_webhook_error', error && error.message || 'unknown');
    return respond({ ok: false, error: 'Payload inválido' }, 400);
  }
}

async function admin(req, store) {
  if (req.method !== 'GET') return respond({ ok: false, error: 'Método não permitido' }, 405);
  const url = new URL(req.url);
  const key = String(url.searchParams.get('key') || req.headers.get('x-admin-key') || '');
  const expected = String(Netlify.env.get('ADMIN_DASHBOARD_KEY') || process.env.ADMIN_DASHBOARD_KEY || '');
  if (!expected || !secureEqual(key, expected)) return respond({ ok: false, error: 'Não autorizado' }, 401);
  try {
    let cursor;
    const items = [];
    do {
      const page = await store.list({ prefix: 'inscricoes/', cursor, limit: 100 });
      for (const entry of page.blobs || []) {
        const item = await readJson(store, entry.key);
        if (item) items.push(item);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    items.sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    return respond({ ok: true, items });
  } catch (error) {
    console.error('admin_registrations_error', error && error.message || 'unknown');
    return respond({ ok: false, error: 'Falha ao carregar inscrições' }, 500);
  }
}

export default async function handler(req, context) {
  const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  const store = getDb(context);
  if (path === '/api/register') return register(req, store);
  if (path === '/api/payment-status') return status(req, store);
  if (path === '/api/asaas-webhook') return webhook(req, store);
  if (path === '/api/admin-inscricoes') return admin(req, store);
  return respond({ ok: false, error: 'Rota não encontrada' }, 404);
}
export const config = { path: ['/api/register', '/api/payment-status', '/api/asaas-webhook', '/api/admin-inscricoes'] };
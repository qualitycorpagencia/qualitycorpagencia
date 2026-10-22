const { put, head, get } = require('@vercel/blob');

async function readJson(pathname) {
  try {
    const blob = await head(pathname, { access: 'private' });
    if (!blob?.url) return null;
    const response = await get(blob.url, { access: 'private' });
    if (!response?.stream) return null;
    return await new Response(response.stream).json();
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const eventName = String(body.event || body.status || '').toLowerCase();
    const orderNsuRaw = body.order_nsu || body.orderNsu || '';
    const orderNsu = String(orderNsuRaw).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    const transactionNsu = String(body.transaction_nsu || body.transactionNsu || Date.now())
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 100);

    const event = {
      recebido_em: new Date().toISOString(),
      origem: 'infinitepay',
      event: eventName || 'payment_notification',
      order_nsu: orderNsuRaw || null,
      transaction_nsu: body.transaction_nsu || body.transactionNsu || null,
      slug: body.slug || body.invoice_slug || null,
      amount: body.amount ?? null,
      paid_amount: body.paid_amount ?? null,
      installments: body.installments ?? null,
      capture_method: body.capture_method || null,
      receipt_url: body.receipt_url || null,
      payload: body
    };

    await put(
      `infinitepay-webhooks/${orderNsu || 'sem-order'}-${transactionNsu}.json`,
      JSON.stringify(event, null, 2),
      {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        overwrite: true
      }
    );

    if (orderNsu) {
      const registrationPath = `inscricoes/${orderNsu}.json`;
      const registration = await readJson(registrationPath);
      if (registration) {
        const paid = eventName === 'paid' || eventName === 'settled';
        const refunded = eventName === 'refunded';
        const canceled = eventName === 'canceled' || eventName === 'payment_failed';

        registration.status_pagamento = paid ? 'pago' : refunded ? 'estornado' : canceled ? 'cancelado' : registration.status_pagamento || 'pendente';
        registration.pagamento = {
          event: eventName,
          transaction_nsu: event.transaction_nsu,
          slug: event.slug,
          amount: event.amount,
          paid_amount: event.paid_amount,
          installments: event.installments,
          capture_method: event.capture_method,
          receipt_url: event.receipt_url,
          atualizado_em: new Date().toISOString()
        };

        await put(
          registrationPath,
          JSON.stringify(registration, null, 2),
          {
            access: 'private',
            contentType: 'application/json',
            addRandomSuffix: false,
            overwrite: true
          }
        );
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('infinitepay_webhook_error', error);
    return res.status(400).json({ ok: false, error: 'Payload inválido' });
  }
};

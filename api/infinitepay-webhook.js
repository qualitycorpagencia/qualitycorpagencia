const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const orderNsu = String(body.order_nsu || body.orderNsu || 'sem-order-nsu')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 80);
    const transactionNsu = String(body.transaction_nsu || body.transactionNsu || Date.now())
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 100);

    const event = {
      recebido_em: new Date().toISOString(),
      origem: 'infinitepay',
      order_nsu: body.order_nsu || null,
      transaction_nsu: body.transaction_nsu || null,
      invoice_slug: body.invoice_slug || body.slug || null,
      amount: body.amount ?? null,
      paid_amount: body.paid_amount ?? null,
      installments: body.installments ?? null,
      capture_method: body.capture_method || null,
      receipt_url: body.receipt_url || null,
      status_recebido: body.event || body.status || 'payment_notification',
      payload: body
    };

    await put(
      `infinitepay-webhooks/${orderNsu}-${transactionNsu}.json`,
      JSON.stringify(event, null, 2),
      {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        overwrite: true
      }
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('infinitepay_webhook_error', error);
    return res.status(400).json({ ok: false, error: 'Payload inválido' });
  }
};

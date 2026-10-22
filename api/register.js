const { put } = require('@vercel/blob');

const INFINITEPAY_HANDLE = 'qualitycorp';
const REDIRECT_URL = 'https://confraternizacaostnb2026.vercel.app/pagamento-concluido/';
const WEBHOOK_URL = 'https://confraternizacaostnb2026.vercel.app/api/infinitepay-webhook';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const nome = String(body.nome || '').trim();
    const whatsapp = String(body.whatsapp || '').trim();
    const turma = String(body.turma || '').trim();
    const adultos = Number(body.adultos || 0);
    const criancas = Number(body.criancas || 0);
    const id = String(body.inscricao_id || '').trim();

    if (!nome || !whatsapp || !turma || !id || !Number.isFinite(adultos) || adultos < 1 || adultos > 20) {
      return res.status(400).json({ ok: false, error: 'Dados obrigatórios inválidos' });
    }

    const safeId = id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    const totalCentavos = adultos * 6200;

    const registration = {
      inscricao_id: safeId,
      nome,
      whatsapp,
      turma,
      adultos,
      criancas: Number.isFinite(criancas) ? criancas : 0,
      acompanhantes: Array.isArray(body.acompanhantes) ? body.acompanhantes : [],
      criancas_detalhes: Array.isArray(body.criancas_detalhes) ? body.criancas_detalhes : [],
      observacoes: String(body.observacoes || '').trim(),
      valor_total: totalCentavos / 100,
      status_pagamento: 'pendente',
      ciencia: body.ciencia === 'sim' ? 'sim' : String(body.ciencia || ''),
      criado_em: new Date().toISOString()
    };

    await put(
      `inscricoes/${safeId}.json`,
      JSON.stringify(registration, null, 2),
      {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        overwrite: true
      }
    );

    const checkoutPayload = {
      handle: INFINITEPAY_HANDLE,
      order_nsu: safeId,
      redirect_url: REDIRECT_URL,
      webhook: {
        url: WEBHOOK_URL,
        events: ['paid', 'settled', 'refunded', 'canceled', 'payment_failed']
      },
      single_payment: true,
      items: [
        {
          quantity: adultos,
          price: 6200,
          description: 'Confraternização STNB Polo Campinas 2026'
        }
      ],
      customer: {
        name: nome,
        phone_number: whatsapp.replace(/\D/g, '').startsWith('55')
          ? '+' + whatsapp.replace(/\D/g, '')
          : '+55' + whatsapp.replace(/\D/g, '')
      }
    };

    const checkoutResponse = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload)
    });

    const checkoutData = await checkoutResponse.json().catch(() => ({}));
    if (!checkoutResponse.ok || !checkoutData.url) {
      console.error('infinitepay_checkout_error', checkoutResponse.status, checkoutData);
      return res.status(502).json({ ok: false, error: 'Não foi possível gerar o checkout da InfinitePay' });
    }

    await put(
      `checkouts/${safeId}.json`,
      JSON.stringify({
        inscricao_id: safeId,
        checkout_url: checkoutData.url,
        valor_total: totalCentavos / 100,
        criado_em: new Date().toISOString()
      }, null, 2),
      {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        overwrite: true
      }
    );

    return res.status(200).json({
      ok: true,
      id: safeId,
      total: totalCentavos / 100,
      checkout_url: checkoutData.url
    });
  } catch (error) {
    console.error('registration_error', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível concluir a inscrição' });
  }
};

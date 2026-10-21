const { put } = require('@vercel/blob');

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

    if (!nome || !whatsapp || !turma || !id || !Number.isFinite(adultos) || adultos < 1) {
      return res.status(400).json({ ok: false, error: 'Dados obrigatórios inválidos' });
    }

    const safeId = id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
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
      valor_total: Number(body.valor_total || adultos * 62),
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

    return res.status(200).json({ ok: true, id: safeId });
  } catch (error) {
    console.error('registration_error', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível salvar a inscrição' });
  }
};

const { list, get } = require('@vercel/blob');

async function readBlobJson(url) {
  const response = await get(url, { access: 'private' });
  if (!response?.stream) return null;
  return await new Response(response.stream).json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  const key = String(req.query?.key || req.headers['x-admin-key'] || '');
  const expected = process.env.ADMIN_DASHBOARD_KEY || '';
  if (!expected || key !== expected) {
    return res.status(401).json({ ok: false, error: 'Não autorizado' });
  }

  try {
    let cursor;
    const items = [];
    do {
      const page = await list({ prefix: 'inscricoes/', cursor, limit: 100, access: 'private' });
      for (const blob of page.blobs || []) {
        const data = await readBlobJson(blob.url);
        if (data) items.push(data);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    items.sort((a,b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    return res.status(200).json({ ok: true, items });
  } catch (error) {
    console.error('admin_registrations_error', error);
    return res.status(500).json({ ok: false, error: 'Falha ao carregar inscrições' });
  }
};

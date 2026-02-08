const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');

const DEFAULT_ITEMS = [
  ['Abacaxi', 'ingrediente', 1250, 'g', 10.0],
  ['Achocolatado', 'ingrediente', 370, 'g', 7.8],
  ['Açúcar cristal', 'ingrediente', 1000, 'g', 3.72],
  ['Açúcar de confeiteiro', 'ingrediente', 500, 'g', 4.0],
  ['Açúcar demerara', 'ingrediente', 1000, 'g', 5.0],
  ['Açúcar refinado', 'ingrediente', 1000, 'g', 4.0],
  ['Amido de milho', 'ingrediente', 200, 'g', 7.0],
  ['Bicarbonato de sódio', 'ingrediente', 500, 'g', 10.55],
  ['Biscoito maisena', 'ingrediente', 400, 'g', 9.0],
  ['Cacau em pó', 'ingrediente', 250, 'g', 10.0],
  ['Canela em pó', 'ingrediente', 50, 'g', 5.0],
  ['Cenoura', 'ingrediente', 1000, 'g', 11.0],
  ['Chantilly', 'ingrediente', 1000, 'g', 12.0],
  ['Chocolate ao leite', 'ingrediente', 380, 'g', 13.0],
  ['Chocolate branco', 'ingrediente', 1000, 'g', 14.0],
  ['Chocolate em pó', 'ingrediente', 1000, 'g', 26.0],
  ['Chocolate meio amargo', 'ingrediente', 1000, 'g', 16.0],
  ['Coco ralado', 'ingrediente', 100, 'g', 17.0],
  ['Confeitos', 'ingrediente', 100, 'g', 18.0],
  ['Cravo em pó', 'ingrediente', 250, 'g', 7.29],
  ['Creme de leite', 'ingrediente', 200, 'g', 19.0],
  ['Doce de leite', 'ingrediente', 395, 'g', 20.0],
  ['Doce de leite Itambé', 'ingrediente', 395, 'g', 9.85],
  ['Essência de baunilha', 'ingrediente', 30, 'ml', 21.0],
  ['Farinha de trigo', 'ingrediente', 1000, 'g', 4.0],
  ['Fermento em pó', 'ingrediente', 100, 'g', 2.5],
  ['Granulado', 'ingrediente', 50, 'g', 24.0],
  ['Leite', 'ingrediente', 1000, 'ml', 300.0],
  ['Leite condensado', 'ingrediente', 395, 'g', 4.5],
  ['Leite de coco', 'ingrediente', 400, 'ml', 27.0],
  ['Leite em pó', 'ingrediente', 400, 'g', 28.0],
  ['Limão', 'ingrediente', 1000, 'g', 29.0],
  ['Mel', 'ingrediente', 1000, 'g', 38.0],
  ['Manteiga', 'ingrediente', 200, 'g', 7.0],
  ['Morango', 'ingrediente', 1000, 'g', 32.0],
  ['Nutella', 'ingrediente', 400, 'g', 33.0],
  ['Óleo', 'ingrediente', 900, 'ml', 7.0],
  ['Ovos (em unidades)', 'ingrediente', 20, 'un', 17.9],
  ['Laranja', 'ingrediente', 1000, 'g', 2.0]
];

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = DEFAULT_ITEMS.map((item, i) => ({
      id: i + 1,
      nome: item[0],
      categoria: item[1],
      quantidade_base: item[2],
      tipo_quantidade: item[3],
      preco_por_quantidade: item[4]
    }));
    const data = { nextId: seeded.length + 1, items: seeded };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  }
}

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function validateItem(item) {
  const categorias = ['ingrediente', 'mao_de_obra', 'outros_custos'];
  if (!item || typeof item.nome !== 'string' || !item.nome.trim()) return 'O nome do item é obrigatório.';
  if (!categorias.includes(item.categoria)) return 'Categoria inválida.';
  if (!(Number(item.quantidade_base) > 0)) return 'Quantidade base deve ser maior que zero.';
  if (typeof item.tipo_quantidade !== 'string' || !item.tipo_quantidade.trim()) return 'Tipo de quantidade é obrigatório.';
  if (!(Number(item.preco_por_quantidade) >= 0)) return 'Preço por quantidade não pode ser negativo.';
  return null;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload muito grande.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(reqPath, res) {
  const filePath = reqPath === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, reqPath);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Acesso negado.' });
    return;
  }

  fs.readFile(normalized, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo não encontrado.');
      return;
    }
    const ext = path.extname(normalized);
    const type = ext === '.html'
      ? 'text/html; charset=utf-8'
      : ext === '.js'
        ? 'application/javascript; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

ensureDataFile();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/items' && req.method === 'GET') {
    const data = loadData();
    data.items.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    sendJson(res, 200, data.items);
    return;
  }

  if (url.pathname === '/api/items' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      const error = validateItem(payload);
      if (error) return sendJson(res, 400, { error });

      const data = loadData();
      const item = {
        id: data.nextId,
        nome: payload.nome.trim(),
        categoria: payload.categoria,
        quantidade_base: Number(payload.quantidade_base),
        tipo_quantidade: payload.tipo_quantidade.trim(),
        preco_por_quantidade: Number(payload.preco_por_quantidade)
      };
      data.items.push(item);
      data.nextId += 1;
      saveData(data);
      sendJson(res, 201, { id: item.id });
    } catch (e) {
      sendJson(res, 400, { error: e.message || 'Erro na requisição.' });
    }
    return;
  }

  const match = url.pathname.match(/^\/api\/items\/(\d+)$/);
  if (match && req.method === 'PUT') {
    try {
      const payload = await parseBody(req);
      const error = validateItem(payload);
      if (error) return sendJson(res, 400, { error });

      const id = Number(match[1]);
      const data = loadData();
      const index = data.items.findIndex((i) => i.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Item não encontrado.' });

      data.items[index] = {
        id,
        nome: payload.nome.trim(),
        categoria: payload.categoria,
        quantidade_base: Number(payload.quantidade_base),
        tipo_quantidade: payload.tipo_quantidade.trim(),
        preco_por_quantidade: Number(payload.preco_por_quantidade)
      };
      saveData(data);
      sendJson(res, 200, { success: true });
    } catch (e) {
      sendJson(res, 400, { error: e.message || 'Erro na requisição.' });
    }
    return;
  }

  if (match && req.method === 'DELETE') {
    const id = Number(match[1]);
    const data = loadData();
    const originalLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);
    if (data.items.length === originalLength) {
      sendJson(res, 404, { error: 'Item não encontrado.' });
      return;
    }
    saveData(data);
    sendJson(res, 200, { success: true });
    return;
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Servidor JS puro iniciado em http://localhost:${PORT}`);
});

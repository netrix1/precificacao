import json
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "precificacao.db"
PORT = 3000


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                categoria TEXT NOT NULL CHECK (categoria IN ('ingrediente', 'mao_de_obra', 'outros_custos')),
                quantidade_base REAL NOT NULL,
                tipo_quantidade TEXT NOT NULL,
                preco_por_quantidade REAL NOT NULL
            )
            """
        )


def validate_item(item):
    categorias = {"ingrediente", "mao_de_obra", "outros_custos"}
    if not item.get("nome") or not isinstance(item["nome"], str):
        return "O nome do item é obrigatório."
    if item.get("categoria") not in categorias:
        return "Categoria inválida."
    if float(item.get("quantidade_base", 0)) <= 0:
        return "Quantidade base deve ser maior que zero."
    if not item.get("tipo_quantidade") or not isinstance(item["tipo_quantidade"], str):
        return "Tipo de quantidade é obrigatório."
    if float(item.get("preco_por_quantidade", -1)) < 0:
        return "Preço por quantidade não pode ser negativo."
    return None


class Handler(BaseHTTPRequestHandler):
    def _json_response(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _serve_file(self, file_name):
        path = (ROOT / file_name).resolve()
        if ROOT not in path.parents and path != ROOT:
            self._json_response(403, {"error": "Acesso negado."})
            return
        if not path.exists() or not path.is_file():
            self.send_response(404)
            self.end_headers()
            self.wfile.write("Arquivo não encontrado.".encode("utf-8"))
            return

        mime = "text/plain; charset=utf-8"
        if path.suffix == ".html":
            mime = "text/html; charset=utf-8"
        elif path.suffix == ".js":
            mime = "application/javascript; charset=utf-8"
        elif path.suffix == ".css":
            mime = "text/css; charset=utf-8"

        content = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/items":
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute("SELECT * FROM items ORDER BY nome ASC").fetchall()
                self._json_response(200, [dict(row) for row in rows])
            return

        target = "index.html" if parsed.path == "/" else parsed.path.lstrip("/")
        self._serve_file(target)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/items":
            self._json_response(404, {"error": "Rota não encontrada."})
            return

        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            self._json_response(400, {"error": "JSON inválido."})
            return

        validation = validate_item(payload)
        if validation:
            self._json_response(400, {"error": validation})
            return

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute(
                """
                INSERT INTO items (nome, categoria, quantidade_base, tipo_quantidade, preco_por_quantidade)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    payload["nome"].strip(),
                    payload["categoria"],
                    float(payload["quantidade_base"]),
                    payload["tipo_quantidade"].strip(),
                    float(payload["preco_por_quantidade"]),
                ),
            )
            self._json_response(201, {"id": cursor.lastrowid})

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/items/"):
            self._json_response(404, {"error": "Rota não encontrada."})
            return

        try:
            item_id = int(parsed.path.split("/")[-1])
            payload = self._read_json()
        except ValueError:
            self._json_response(400, {"error": "ID inválido."})
            return
        except json.JSONDecodeError:
            self._json_response(400, {"error": "JSON inválido."})
            return

        validation = validate_item(payload)
        if validation:
            self._json_response(400, {"error": validation})
            return

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute(
                """
                UPDATE items
                SET nome = ?, categoria = ?, quantidade_base = ?, tipo_quantidade = ?, preco_por_quantidade = ?
                WHERE id = ?
                """,
                (
                    payload["nome"].strip(),
                    payload["categoria"],
                    float(payload["quantidade_base"]),
                    payload["tipo_quantidade"].strip(),
                    float(payload["preco_por_quantidade"]),
                    item_id,
                ),
            )
            if cursor.rowcount == 0:
                self._json_response(404, {"error": "Item não encontrado."})
                return
            self._json_response(200, {"success": True})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/items/"):
            self._json_response(404, {"error": "Rota não encontrada."})
            return

        try:
            item_id = int(parsed.path.split("/")[-1])
        except ValueError:
            self._json_response(400, {"error": "ID inválido."})
            return

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
            if cursor.rowcount == 0:
                self._json_response(404, {"error": "Item não encontrado."})
                return
            self._json_response(200, {"success": True})


if __name__ == "__main__":
    init_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Servidor iniciado em http://localhost:{PORT}")
    server.serve_forever()

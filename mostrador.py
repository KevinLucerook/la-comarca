"""Mostrador local de La Comarca. Sirve la página y guarda productos solo en este equipo."""

import base64
import hashlib
import hmac
import json
import os
import re
import threading
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATOS = ROOT / "data" / "productos.json"
ACCESO = ROOT / "data" / "acceso.json"
FOTOS = ROOT / "assets" / "tienda"
CANDADO = threading.Lock()
MAXIMO = 4_000_000

os.chdir(ROOT)


def leer():
    if not DATOS.exists():
        return {"productos": []}
    try:
        datos = json.loads(DATOS.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"productos": []}
    if not isinstance(datos, dict) or not isinstance(datos.get("productos"), list):
        return {"productos": []}
    return datos


def guardar(datos):
    DATOS.parent.mkdir(parents=True, exist_ok=True)
    temporal = DATOS.with_suffix(".json.tmp")
    temporal.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporal.replace(DATOS)


def huella_clave(clave):
    return hashlib.sha256(f"comarca:{clave}".encode("utf-8")).hexdigest()


def leer_acceso():
    if not ACCESO.exists():
        return None
    try:
        datos = json.loads(ACCESO.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    huella = datos.get("huella") if isinstance(datos, dict) else None
    if isinstance(huella, str) and re.fullmatch(r"[a-f0-9]{64}", huella):
        return huella
    return None


def guardar_acceso(huella):
    ACCESO.parent.mkdir(parents=True, exist_ok=True)
    temporal = ACCESO.with_suffix(".json.tmp")
    temporal.write_text(json.dumps({"huella": huella}) + "\n", encoding="utf-8")
    temporal.replace(ACCESO)


def clave_valida(clave):
    return isinstance(clave, str) and re.fullmatch(r"\S{4,40}", clave.strip()) is not None


def clave_ok(clave):
    huella = leer_acceso()
    if not huella or not clave_valida(str(clave or "")):
        return False
    return hmac.compare_digest(huella_clave(str(clave).strip()), huella)


def precio_valido(valor):
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return None
    if valor <= 0 or valor > 10_000_000:
        return None
    return round(float(valor), 2)


def texto_limpio(valor, limite):
    texto = re.sub(r"\s+", " ", str(valor or "")).strip()
    return texto[:limite]


def foto_de(datos_b64):
    try:
        crudo = base64.b64decode(datos_b64, validate=True)
    except (ValueError, TypeError):
        return None
    if len(crudo) > 3_000_000:
        return None
    if crudo.startswith(b"\xff\xd8\xff"):
        return crudo, ".jpg"
    if crudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return crudo, ".png"
    if crudo.startswith(b"RIFF") and crudo[8:12] == b"WEBP":
        return crudo, ".webp"
    return None


def ruta_foto(valor):
    if not isinstance(valor, str):
        return None
    ruta = Path(valor)
    if ruta.is_absolute() or ".." in ruta.parts:
        return None
    destino = (ROOT / ruta).resolve()
    try:
        destino.relative_to(FOTOS.resolve())
    except ValueError:
        return None
    return destino


def borrar_foto(valor):
    destino = ruta_foto(valor)
    if destino and destino.is_file():
        destino.unlink()


class Mostrador(SimpleHTTPRequestHandler):
    def _json(self, codigo, cuerpo):
        crudo = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(crudo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(crudo)

    def do_GET(self):
        ruta = urlparse(self.path).path
        if ruta == "/api/productos":
            self._json(200, {"ok": True, **leer()})
            return
        if ruta == "/api/acceso":
            self._json(200, {"ok": True, "hayClave": leer_acceso() is not None})
            return
        super().do_GET()

    def _cuerpo(self):
        largo = int(self.headers.get("Content-Length", "0") or "0")
        if largo <= 0 or largo > MAXIMO:
            return None, "El envío no tiene un tamaño válido."
        try:
            cuerpo = json.loads(self.rfile.read(largo).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, "No se entendió el pedido."
        if not isinstance(cuerpo, dict):
            return None, "No se entendió el pedido."
        return cuerpo, ""

    def _acceso(self, cuerpo):
        accion = cuerpo.get("accion")
        clave = str(cuerpo.get("clave") or "")
        if not clave_valida(clave):
            self._json(400, {"ok": False, "error": "La clave tiene que tener entre 4 y 40 caracteres, sin espacios."})
            return
        with CANDADO:
            existe = leer_acceso() is not None
            if accion == "crear":
                if existe:
                    self._json(403, {"ok": False, "error": "La clave del mostrador ya existe."})
                    return
                guardar_acceso(huella_clave(clave.strip()))
                self._json(200, {"ok": True})
                return
            if not existe:
                self._json(400, {"ok": False, "error": "Todavía no hay una clave del mostrador."})
                return
            if not clave_ok(clave):
                self._json(401, {"ok": False, "error": "La clave del mostrador no es correcta."})
                return
            self._json(200, {"ok": True})

    def do_POST(self):
        ruta = urlparse(self.path).path
        if ruta not in ("/api/productos", "/api/acceso"):
            self.send_error(404)
            return
        cuerpo, error = self._cuerpo()
        if cuerpo is None:
            self._json(400, {"ok": False, "error": error})
            return
        if ruta == "/api/acceso":
            self._acceso(cuerpo)
            return
        if not clave_ok(cuerpo.get("clave")):
            self._json(401, {"ok": False, "error": "La clave del mostrador no es correcta."})
            return

        with CANDADO:
            datos = leer()
            productos = datos["productos"]
            accion = cuerpo.get("accion") or "guardar"
            if accion == "borrar":
                ident = str(cuerpo.get("id") or "")
                queda = []
                for item in productos:
                    if item.get("id") == ident:
                        borrar_foto(item.get("foto"))
                    else:
                        queda.append(item)
                datos["productos"] = queda
                guardar(datos)
                self._json(200, {"ok": True, "productos": queda})
                return

            nombre = texto_limpio(cuerpo.get("nombre"), 80)
            precio = precio_valido(cuerpo.get("precio"))
            nota = texto_limpio(cuerpo.get("nota"), 240)
            if not nombre:
                self._json(400, {"ok": False, "error": "Falta el nombre de la pieza."})
                return
            if precio is None:
                self._json(400, {"ok": False, "error": "El precio tiene que ser un número mayor a cero."})
                return

            ident = str(cuerpo.get("id") or "").strip() or uuid.uuid4().hex
            if not re.fullmatch(r"[a-f0-9]{32}", ident):
                self._json(400, {"ok": False, "error": "No se pudo reconocer la pieza."})
                return
            actual = next((item for item in productos if item.get("id") == ident), None)
            foto = actual.get("foto") if actual else ""

            if cuerpo.get("fotoBase64"):
                imagen = foto_de(cuerpo.get("fotoBase64"))
                if not imagen:
                    self._json(400, {"ok": False, "error": "La foto tiene que ser JPG, PNG o WebP, de hasta 3 MB."})
                    return
                crudo, extension = imagen
                FOTOS.mkdir(parents=True, exist_ok=True)
                if foto:
                    borrar_foto(foto)
                destino = FOTOS / f"{ident}{extension}"
                destino.write_bytes(crudo)
                foto = f"assets/tienda/{destino.name}"

            pieza = {"id": ident, "nombre": nombre, "precio": precio, "nota": nota, "foto": foto or ""}
            if actual:
                productos[productos.index(actual)] = pieza
            else:
                productos.append(pieza)
            guardar(datos)
            self._json(200, {"ok": True, "productos": productos})

    def log_message(self, formato, *args):
        print("[%s] %s" % (self.log_date_time_string(), formato % args))


if __name__ == "__main__":
    FOTOS.mkdir(parents=True, exist_ok=True)
    servidor = ThreadingHTTPServer(("127.0.0.1", 8765), Mostrador)
    print("Mostrador en http://127.0.0.1:8765/")
    print("Tienda: http://127.0.0.1:8765/tienda.html")
    print("Cargar: http://127.0.0.1:8765/cargar.html")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        servidor.server_close()

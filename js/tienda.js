const estante = document.querySelector("#estante");
const pedidoPanel = document.querySelector("#pedido");
const pedidoLineas = document.querySelector("#pedido-lineas");
const pedidoVacio = document.querySelector("#pedido-vacio");
const pedidoTotal = document.querySelector("#pedido-total");
const pedidoNota = document.querySelector("#pedido-nota");
const enviarPedido = document.querySelector("#enviar-pedido");
const pedidoMensaje = document.querySelector("#pedido-mensaje");
const pedidoFijo = document.querySelector("#pedido-fijo");
const pedidoFijoTexto = document.querySelector("#pedido-fijo-texto");
const estado = document.querySelector("#tienda-estado");
const CLAVE_PEDIDO = "comarca_pedido";

let catalogo = [];
const pedido = new Map();

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[caracter]));
}

function mostrarPrecio(valor) {
  const entero = Math.round(Number(valor) * 100) % 100 === 0;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(valor));
}

function fotoSegura(ruta) {
  return typeof ruta === "string" && /^assets\/tienda\/[a-z0-9.-]+$/i.test(ruta);
}

function limitarCantidad(valor) {
  const numero = Math.round(Number(valor));
  if (!Number.isFinite(numero)) return 1;
  return Math.min(99, Math.max(1, numero));
}

function guardarPedido() {
  const nota = pedidoNota ? pedidoNota.value : "";
  const lineas = [...pedido.entries()].map(([id, cantidad]) => ({ id, cantidad }));
  sessionStorage.setItem(CLAVE_PEDIDO, JSON.stringify({ lineas, nota }));
}

function restaurarPedido() {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE_PEDIDO) || "null");
    if (!guardado) return;
    if (pedidoNota && typeof guardado.nota === "string") pedidoNota.value = guardado.nota.slice(0, 240);
    (guardado.lineas || []).forEach((linea) => {
      if (catalogo.some((producto) => producto.id === linea.id)) {
        pedido.set(linea.id, limitarCantidad(linea.cantidad));
      }
    });
  } catch {
    sessionStorage.removeItem(CLAVE_PEDIDO);
  }
}

function piezaHtml(producto) {
  const foto = fotoSegura(producto.foto)
    ? `<img src="${escapar(producto.foto)}" alt="" width="800" height="600" loading="lazy" />`
    : `<div class="pieza-hueco" aria-hidden="true"><span></span></div>`;
  const nota = String(producto.nota || "").trim();
  return `
    <article class="pieza" data-id="${escapar(producto.id)}">
      ${foto}
      <div class="pieza-cuerpo">
        <h3>${escapar(producto.nombre)}</h3>
        ${nota ? `<p class="pieza-nota">${escapar(nota)}</p>` : ""}
        <p class="precio">${escapar(mostrarPrecio(producto.precio))}</p>
        <div class="cantidad">
          <button type="button" data-menos aria-label="Bajar cantidad">−</button>
          <input type="text" inputmode="numeric" value="1" maxlength="2" aria-label="Cantidad" />
          <button type="button" data-mas aria-label="Subir cantidad">+</button>
        </div>
        <button class="button" type="button" data-sumar>Sumar al pedido</button>
      </div>
    </article>
  `;
}

function cantidadDeTarjeta(tarjeta) {
  return limitarCantidad(tarjeta.querySelector("input")?.value);
}

function marcarTarjetas() {
  estante.querySelectorAll(".pieza").forEach((tarjeta) => {
    const boton = tarjeta.querySelector("[data-sumar]");
    if (!boton) return;
    boton.textContent = pedido.has(tarjeta.dataset.id) ? "Sumar más" : "Sumar al pedido";
  });
}

function lineasDelPedido() {
  return [...pedido.entries()]
    .map(([id, cantidad]) => {
      const producto = catalogo.find((item) => item.id === id);
      if (!producto) return null;
      const unitario = Number(producto.precio);
      return {
        producto,
        cantidad,
        unitario,
        subtotal: Math.round(unitario * cantidad * 100) / 100,
      };
    })
    .filter(Boolean);
}

function textoPedido() {
  const lineas = lineasDelPedido();
  const total = lineas.reduce((suma, linea) => suma + linea.subtotal, 0);
  const nota = pedidoNota.value.trim();
  return [
    "Hola.",
    "Quiero encargar estas piezas en La Comarca:",
    "",
    ...lineas.map(
      (linea, indice) =>
        `${indice + 1}. ${linea.producto.nombre} × ${linea.cantidad} — ${mostrarPrecio(linea.unitario)} cada una — ${mostrarPrecio(linea.subtotal)}`,
    ),
    "",
    `Total publicado: ${mostrarPrecio(total)}.`,
    nota ? `Nota: ${nota}` : "",
    "Si hay que cambiar color, tamaño o fecha, lo vemos en este chat.",
  ]
    .filter((linea) => linea !== "")
    .join("\n");
}

function pintarPedido() {
  const lineas = lineasDelPedido();
  const total = lineas.reduce((suma, linea) => suma + linea.subtotal, 0);
  const unidades = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  pedidoVacio.hidden = lineas.length > 0;
  pedidoTotal.hidden = lineas.length === 0;
  enviarPedido.disabled = lineas.length === 0;
  pedidoLineas.innerHTML = lineas
    .map(
      (linea) => `
        <li>
          <div>
            <strong>${escapar(linea.producto.nombre)}</strong>
            <span>${escapar(mostrarPrecio(linea.unitario))} cada una</span>
          </div>
          <div class="cantidad">
            <button type="button" data-bajar="${escapar(linea.producto.id)}" aria-label="Bajar cantidad">−</button>
            <span>${linea.cantidad}</span>
            <button type="button" data-subir="${escapar(linea.producto.id)}" aria-label="Subir cantidad">+</button>
          </div>
          <b>${escapar(mostrarPrecio(linea.subtotal))}</b>
          <button type="button" class="quitar" data-sacar="${escapar(linea.producto.id)}">Quitar</button>
        </li>
      `,
    )
    .join("");
  if (lineas.length) pedidoTotal.textContent = `Total publicado: ${mostrarPrecio(total)}`;
  if (pedidoMensaje) {
    pedidoMensaje.hidden = true;
    pedidoMensaje.value = "";
  }
  if (estado) estado.textContent = "";
  if (pedidoFijo) {
    pedidoFijo.hidden = lineas.length === 0;
    if (pedidoFijoTexto) {
      pedidoFijoTexto.textContent = `${unidades} ${unidades === 1 ? "pieza" : "piezas"} · ${mostrarPrecio(total)}`;
    }
  }
  marcarTarjetas();
}

estante.addEventListener("click", (evento) => {
  const tarjeta = evento.target.closest(".pieza");
  if (!tarjeta) return;
  const entrada = tarjeta.querySelector("input");
  if (evento.target.matches("[data-menos]")) {
    entrada.value = String(limitarCantidad(Number(entrada.value) - 1));
  }
  if (evento.target.matches("[data-mas]")) {
    entrada.value = String(limitarCantidad(Number(entrada.value) + 1));
  }
  if (evento.target.matches("[data-sumar]")) {
    const id = tarjeta.dataset.id;
    const suma = (pedido.get(id) || 0) + cantidadDeTarjeta(tarjeta);
    pedido.set(id, limitarCantidad(suma));
    guardarPedido();
    pintarPedido();
    pedidoPanel.hidden = false;
    if (estado) estado.textContent = "La pieza entró al pedido.";
  }
});

estante.addEventListener("change", (evento) => {
  if (evento.target.matches("input")) evento.target.value = String(limitarCantidad(evento.target.value));
});

pedidoLineas.addEventListener("click", (evento) => {
  const bajar = evento.target.closest("[data-bajar]");
  const subir = evento.target.closest("[data-subir]");
  const sacar = evento.target.closest("[data-sacar]");
  const id = (bajar || subir || sacar)?.dataset.bajar || (subir || sacar)?.dataset.subir || sacar?.dataset.sacar;
  if (!id || !pedido.has(id)) return;
  if (sacar) pedido.delete(id);
  if (bajar) {
    const siguiente = pedido.get(id) - 1;
    if (siguiente < 1) pedido.delete(id);
    else pedido.set(id, siguiente);
  }
  if (subir) pedido.set(id, limitarCantidad(pedido.get(id) + 1));
  guardarPedido();
  pintarPedido();
});

pedidoNota.addEventListener("input", () => {
  guardarPedido();
  if (pedidoMensaje && !pedidoMensaje.hidden) {
    pedidoMensaje.hidden = true;
    pedidoMensaje.value = "";
    if (estado) estado.textContent = "El pedido cambió. Volvé a tocar Pedir por Instagram.";
  }
});

enviarPedido.addEventListener("click", async () => {
  if (!lineasDelPedido().length) return;
  const mensaje = textoPedido();
  pedidoMensaje.value = mensaje;
  pedidoMensaje.hidden = false;
  try {
    await navigator.clipboard.writeText(mensaje);
    estado.textContent = "Pedido copiado. En el celular, pegalo en el chat de Instagram. En la computadora, abrí Instagram y pegalo en el mensaje directo.";
  } catch {
    estado.textContent = "Copiá el pedido de abajo y pegalo en el mensaje directo de Instagram.";
  }
  window.open("https://ig.me/m/lacomarca.impresiones", "_blank", "noopener");
});

async function pintarEstante() {
  if (!estante) return;
  try {
    const respuesta = await fetch(`data/productos.json?t=${Date.now()}`);
    if (!respuesta.ok) throw new Error("sin mostrador");
    const datos = await respuesta.json();
    catalogo = Array.isArray(datos.productos) ? datos.productos : [];
  } catch {
    estante.innerHTML = `<p class="tienda-vacia">El estante no se pudo abrir en este momento.</p>`;
    return;
  }

  if (!catalogo.length) {
    estante.innerHTML = `<p class="tienda-vacia">Todavía no hay piezas con precio en el estante.</p>`;
    return;
  }

  restaurarPedido();
  estante.innerHTML = catalogo.map(piezaHtml).join("");
  pedidoPanel.hidden = false;
  pintarPedido();
}

pintarEstante();

const form = document.querySelector("#form-producto");
const estado = document.querySelector("#cargar-estado");
const lista = document.querySelector("#lista-productos");
const tituloBoton = document.querySelector("#guardar-producto");
const cancelar = document.querySelector("#cancelar-edicion");
const idCampo = document.querySelector("#producto-id");

function mostrarPrecio(valor) {
  const entero = Math.round(Number(valor) * 100) % 100 === 0;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(valor));
}

function leerPrecio(texto) {
  let normal = String(texto || "").trim().replace(/\s/g, "").replace(/^\$/, "");
  if (!normal) return null;
  if (normal.includes(",") && normal.includes(".")) normal = normal.replace(/\./g, "").replace(",", ".");
  else if (normal.includes(",")) normal = normal.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(normal)) normal = normal.replace(/\./g, "");
  const valor = Number(normal);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 10000000) return null;
  return Math.round(valor * 100) / 100;
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[caracter]));
}

function fotoSegura(ruta) {
  return typeof ruta === "string" && /^assets\/tienda\/[a-z0-9.-]+$/i.test(ruta);
}

async function archivoABase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binario = "";
  const paso = 0x4000;
  for (let i = 0; i < bytes.length; i += paso) {
    binario += String.fromCharCode(...bytes.subarray(i, i + paso));
  }
  return btoa(binario);
}

function decir(texto) {
  estado.textContent = texto;
}

function limpiarFormulario() {
  form.reset();
  idCampo.value = "";
  tituloBoton.textContent = "Guardar en el estante";
  cancelar.hidden = true;
}

function filaHtml(producto) {
  const foto = fotoSegura(producto.foto)
    ? `<img src="${escapar(producto.foto)}?t=${Date.now()}" alt="" />`
    : `<div class="fila-mini" aria-hidden="true"><span></span></div>`;
  return `
    <article class="fila-producto">
      ${foto}
      <div>
        <h3>${escapar(producto.nombre)}</h3>
        <p class="precio-fila">${escapar(mostrarPrecio(producto.precio))}</p>
        <div class="fila-acciones">
          <button type="button" data-editar="${escapar(producto.id)}">Editar</button>
          <button type="button" class="quitar" data-quitar="${escapar(producto.id)}">Quitar</button>
        </div>
      </div>
    </article>
  `;
}

function claveGuardada() {
  return sessionStorage.getItem("comarca_clave") || "";
}

async function pedir(cuerpo) {
  const respuesta = await fetch("/api/productos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...cuerpo, clave: claveGuardada() }),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401) {
    sessionStorage.removeItem("comarca_clave");
    document.querySelector("#zona-productos").hidden = true;
    document.querySelector("#form-clave").hidden = false;
    throw new Error(datos.error || "La clave del mostrador no es correcta.");
  }
  if (!respuesta.ok || !datos.ok) throw new Error(datos.error || "No se pudo guardar.");
  return datos.productos || [];
}

function pintarLista(productos) {
  if (!productos.length) {
    lista.innerHTML = `<p class="tienda-vacia">Todavía no hay productos cargados.</p>`;
    return;
  }
  lista.innerHTML = productos.map(filaHtml).join("");
  lista.querySelectorAll("[data-editar]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const producto = productos.find((item) => item.id === boton.dataset.editar);
      if (!producto) return;
      idCampo.value = producto.id;
      form.nombre.value = producto.nombre;
      form.precio.value = String(producto.precio).replace(".", ",");
      form.nota.value = producto.nota || "";
      form.foto.value = "";
      tituloBoton.textContent = "Guardar cambios";
      cancelar.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      form.nombre.focus();
    });
  });
  lista.querySelectorAll("[data-quitar]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      const producto = productos.find((item) => item.id === boton.dataset.quitar);
      if (!producto) return;
      if (!window.confirm(`¿Quitar «${producto.nombre}» del estante?`)) return;
      try {
        const siguientes = await pedir({ accion: "borrar", id: producto.id });
        if (idCampo.value === producto.id) limpiarFormulario();
        pintarLista(siguientes);
        decir("La pieza salió del estante.");
      } catch (error) {
        decir(error.message || "No se pudo quitar.");
      }
    });
  });
}

async function cargarLista() {
  try {
    const respuesta = await fetch(`/api/productos?t=${Date.now()}`);
    if (!respuesta.ok) throw new Error("apagado");
    const datos = await respuesta.json();
    pintarLista(Array.isArray(datos.productos) ? datos.productos : []);
  } catch {
    lista.innerHTML = `<p class="tienda-vacia">El mostrador local no está encendido. En este equipo se abre con el servidor del taller y después se entra a esta página.</p>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nombre = form.nombre.value.trim();
  const precio = leerPrecio(form.precio.value);
  const nota = form.nota.value.trim();
  if (!nombre) {
    decir("Falta el nombre de la pieza.");
    form.nombre.focus();
    return;
  }
  if (precio == null) {
    decir("El precio tiene que ser un número mayor a cero.");
    form.precio.focus();
    return;
  }
  const archivo = form.foto.files[0];
  if (archivo && archivo.size > 3000000) {
    decir("La foto pesa más de 3 MB. Elegí una más liviana.");
    return;
  }
  if (archivo && !/^image\/(jpeg|png|webp)$/.test(archivo.type)) {
    decir("La foto tiene que ser JPG, PNG o WebP.");
    return;
  }
  const cuerpo = {
    accion: "guardar",
    id: idCampo.value,
    nombre,
    precio,
    nota,
  };
  if (archivo) {
    cuerpo.fotoNombre = archivo.name;
    cuerpo.fotoBase64 = await archivoABase64(archivo);
  }
  tituloBoton.disabled = true;
  try {
    const productos = await pedir(cuerpo);
    pintarLista(productos);
    limpiarFormulario();
    decir("Quedó en el estante. Ya se ve en la tienda de este equipo.");
  } catch (error) {
    decir(error.message || "No se pudo guardar.");
  } finally {
    tituloBoton.disabled = false;
  }
});

cancelar.addEventListener("click", () => {
  limpiarFormulario();
  decir("");
});

const formClave = document.querySelector("#form-clave");
const zona = document.querySelector("#zona-productos");
const tituloClave = document.querySelector("#clave-titulo");
const ayudaClave = document.querySelector("#clave-ayuda");
const estadoClave = document.querySelector("#clave-estado");
const botonClave = document.querySelector("#entrar-clave");
let creandoClave = false;

function abrirMostrador() {
  formClave.hidden = true;
  zona.hidden = false;
  cargarLista();
}

async function prepararEntrada() {
  let datos;
  try {
    const respuesta = await fetch("/api/acceso");
    if (!respuesta.ok) throw new Error("apagado");
    datos = await respuesta.json();
  } catch {
    formClave.hidden = true;
    zona.hidden = true;
    document.querySelector("main .section-inner").insertAdjacentHTML(
      "beforeend",
      `<p class="tienda-vacia">Esta entrada no está disponible.</p>`,
    );
    return;
  }
  creandoClave = !datos.hayClave;
  tituloClave.textContent = creandoClave ? "Crear la clave" : "Clave del mostrador";
  ayudaClave.textContent = creandoClave
    ? "Elegí una clave de al menos 4 caracteres. Quien no la sepa no puede cargar precios."
    : "Esta entrada no está en la tienda. Solo quien tiene la clave puede cargar precios.";
  botonClave.textContent = creandoClave ? "Guardar clave" : "Entrar";
  formClave.clave.autocomplete = creandoClave ? "new-password" : "current-password";
  const guardada = claveGuardada();
  if (!creandoClave && guardada) {
    const respuesta = await fetch("/api/acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "entrar", clave: guardada }),
    });
    if (respuesta.ok) {
      abrirMostrador();
      return;
    }
    sessionStorage.removeItem("comarca_clave");
  }
}

formClave.addEventListener("submit", async (event) => {
  event.preventDefault();
  const clave = formClave.clave.value.trim();
  if (!/^\S{4,40}$/.test(clave)) {
    estadoClave.textContent = "La clave tiene que tener entre 4 y 40 caracteres, sin espacios.";
    return;
  }
  botonClave.disabled = true;
  try {
    const respuesta = await fetch("/api/acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: creandoClave ? "crear" : "entrar", clave }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !datos.ok) throw new Error(datos.error || "No se pudo entrar.");
    sessionStorage.setItem("comarca_clave", clave);
    abrirMostrador();
  } catch (error) {
    estadoClave.textContent = error.message || "No se pudo entrar.";
  } finally {
    botonClave.disabled = false;
  }
});

prepararEntrada();

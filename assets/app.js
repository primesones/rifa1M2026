// Lógica del sitio público (index.html)

const ESTADOS_CLASE = {
  Disponible: 'disponible',
  Reservada: 'reservada',
  Pagada: 'pagada'
};

let numeroSeleccionado = null;

document.addEventListener('DOMContentLoaded', () => {
  cargarConfig();
  cargarBoletas();

  document.getElementById('form-reserva').addEventListener('submit', onSubmitReserva);
  document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModal);
  document.getElementById('btn-cerrar-modal-info').addEventListener('click', cerrarModalInfo);

  setInterval(() => {
    if (document.visibilityState === 'visible') cargarBoletas();
  }, 18000);
});

// Reintenta antes de rendirse: en redes móviles el primer intento a veces
// falla (DNS/TLS lentos) y sin esto la página quedaba vacía hasta el
// siguiente refresco automático a los 18 segundos.
async function fetchConReintentos(url, intentos = 3, esperaMs = 800) {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    } catch (err) {
      ultimoError = err;
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
  throw ultimoError;
}

async function cargarConfig() {
  try {
    const res = await fetchConReintentos(`${WEB_APP_URL}?action=getConfig`);
    const data = await res.json();
    if (!data.ok) return;

    document.getElementById('info-valor-boleta').textContent = formatearCOP(data.valorBoleta);
    document.getElementById('info-loteria').textContent = data.loteria;
    document.getElementById('info-fecha').textContent = formatearFecha(data.fechaSorteo);

    const banner = document.getElementById('banner-ganador');
    if (data.numeroGanador) {
      banner.hidden = false;
      banner.textContent = `🎉 ¡Boleta ganadora: ${data.numeroGanador}!`;
    } else {
      banner.hidden = true;
    }
  } catch (err) {
    console.error('Error cargando config', err);
  }
}

async function cargarBoletas() {
  try {
    const res = await fetchConReintentos(`${WEB_APP_URL}?action=getBoletas`);
    const data = await res.json();
    if (!data.ok) return;
    const boletas = data.boletas.sort((a, b) => a.numero.localeCompare(b.numero));
    renderGrilla(boletas);
    renderListado(boletas);

    const disponibles = boletas.filter((b) => b.estado === 'Disponible').length;
    document.getElementById('info-disponibles').textContent = disponibles;
  } catch (err) {
    console.error('Error cargando boletas', err);
  }
}

function renderGrilla(boletas) {
  const grilla = document.getElementById('grilla');
  grilla.innerHTML = '';
  boletas.forEach((boleta) => {
    const btn = document.createElement('button');
    btn.className = `boleta ${ESTADOS_CLASE[boleta.estado] || 'disponible'}`;
    btn.textContent = boleta.numero;
    btn.addEventListener('click', () => {
      if (boleta.estado === 'Disponible') {
        abrirModal(boleta.numero);
      } else {
        abrirModalInfo(boleta);
      }
    });
    grilla.appendChild(btn);
  });
}

function renderListado(boletas) {
  const tbody = document.getElementById('cuerpo-listado');
  tbody.innerHTML = '';
  boletas.forEach((boleta) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${boleta.numero}</td>
      <td><span class="badge ${ESTADOS_CLASE[boleta.estado] || 'disponible'}">${boleta.estado}</span></td>
      <td>${escaparHtml(boleta.nombre) || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalInfo(boleta) {
  document.getElementById('info-modal-numero').textContent = boleta.numero;
  document.getElementById('info-modal-estado').textContent = boleta.estado;
  document.getElementById('info-modal-nombre').textContent = boleta.nombre || 'Sin datos';
  document.getElementById('modal-info').hidden = false;
}

function cerrarModalInfo() {
  document.getElementById('modal-info').hidden = true;
}

function abrirModal(numero) {
  numeroSeleccionado = numero;
  document.getElementById('modal-numero').textContent = numero;
  document.getElementById('mensaje-reserva').textContent = '';
  document.getElementById('mensaje-reserva').className = 'mensaje-estado';
  document.getElementById('modal-reserva').hidden = false;
}

function cerrarModal() {
  document.getElementById('modal-reserva').hidden = true;
  document.getElementById('form-reserva').reset();
  numeroSeleccionado = null;
}

async function onSubmitReserva(ev) {
  ev.preventDefault();
  const mensaje = document.getElementById('mensaje-reserva');
  const btnConfirmar = document.getElementById('btn-confirmar-reserva');
  mensaje.textContent = '';
  mensaje.className = 'mensaje-estado';

  const nombre = document.getElementById('input-nombre').value.trim();
  const telefono = document.getElementById('input-telefono').value.trim();
  const archivo = document.getElementById('input-comprobante').files[0];

  if (!nombre || !telefono) {
    mensaje.textContent = 'Completa nombre y teléfono.';
    mensaje.className = 'mensaje-estado error';
    return;
  }

  btnConfirmar.disabled = true;
  mensaje.textContent = 'Enviando...';

  try {
    const payload = {
      action: 'reservar',
      numero: numeroSeleccionado,
      nombre,
      telefono
    };

    if (archivo) {
      payload.comprobanteBase64 = await comprimirImagen(archivo);
      payload.nombreArchivo = archivo.name;
    }

    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.ok) {
      mensaje.textContent = `¡Listo! Boleta ${data.numero} reservada a tu nombre.`;
      mensaje.className = 'mensaje-estado exito';
      await cargarBoletas();
      setTimeout(cerrarModal, 1800);
    } else {
      mensaje.textContent = data.error || 'No se pudo reservar la boleta.';
      mensaje.className = 'mensaje-estado error';
      await cargarBoletas();
    }
  } catch (err) {
    mensaje.textContent = 'Error de conexión, intenta de nuevo.';
    mensaje.className = 'mensaje-estado error';
  } finally {
    btnConfirmar.disabled = false;
  }
}

// Redimensiona y comprime la imagen en el navegador antes de enviarla en base64,
// para no arriesgar timeouts del Apps Script con fotos de celular sin comprimir.
function comprimirImagen(file, maxAncho = 1200, calidad = 0.65) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    lector.onerror = reject;
    lector.readAsDataURL(file);
  });
}

// Evita XSS: el nombre lo escribe libremente cualquier visitante en el
// formulario de reserva y se inserta como HTML en el listado público.
function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : String(texto);
  return div.innerHTML;
}

function formatearCOP(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return '';
  const fecha = new Date(fechaISO + 'T00:00:00');
  return fecha.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

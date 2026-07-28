// Lógica de administración (admin.html)
// El "código de admin" es un disuasivo simple, no seguridad fuerte:
// viaja en cada petición y es visible en las devtools del navegador.
// Suficiente para una rifa administrada por una sola persona.

let todasLasBoletas = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-login').addEventListener('submit', onSubmitLogin);
  document.getElementById('form-ganador').addEventListener('submit', onSubmitGanador);
  document.getElementById('filtro-estado').addEventListener('change', renderTabla);
  document.getElementById('btn-actualizar').addEventListener('click', cargarBoletasAdmin);
  document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

  const codigoGuardado = sessionStorage.getItem('codigoAdmin');
  if (codigoGuardado) intentarEntrar(codigoGuardado);
});

function onSubmitLogin(ev) {
  ev.preventDefault();
  const codigo = document.getElementById('input-codigo-admin').value.trim();
  intentarEntrar(codigo);
}

async function intentarEntrar(codigo) {
  const mensaje = document.getElementById('mensaje-login');
  mensaje.textContent = 'Verificando...';
  const data = await fetchBoletasAdmin(codigo);
  if (data && data.ok) {
    sessionStorage.setItem('codigoAdmin', codigo);
    document.getElementById('vista-login').hidden = true;
    document.getElementById('vista-admin').hidden = false;
    todasLasBoletas = data.boletas;
    renderTabla();
  } else {
    mensaje.textContent = (data && data.error) || 'Código incorrecto';
    mensaje.className = 'mensaje-estado error';
  }
}

function cerrarSesion() {
  sessionStorage.removeItem('codigoAdmin');
  document.getElementById('vista-admin').hidden = true;
  document.getElementById('vista-login').hidden = false;
  document.getElementById('input-codigo-admin').value = '';
}

function getCodigoAdmin() {
  return sessionStorage.getItem('codigoAdmin');
}

async function fetchBoletasAdmin(codigo) {
  try {
    const res = await fetch(`${WEB_APP_URL}?action=getBoletasAdmin&codigoAdmin=${encodeURIComponent(codigo)}`);
    return await res.json();
  } catch (err) {
    return { ok: false, error: 'Error de conexión' };
  }
}

async function cargarBoletasAdmin() {
  const data = await fetchBoletasAdmin(getCodigoAdmin());
  if (data && data.ok) {
    todasLasBoletas = data.boletas;
    renderTabla();
  }
}

function renderTabla() {
  const filtro = document.getElementById('filtro-estado').value;
  const tbody = document.getElementById('cuerpo-tabla-admin');
  tbody.innerHTML = '';

  todasLasBoletas
    .filter((b) => filtro === 'Todas' || b.estado === filtro)
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .forEach((boleta) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${boleta.numero}</td>
        <td><span class="badge ${boleta.estado.toLowerCase()}">${boleta.estado}</span></td>
        <td>${boleta.nombre || ''}</td>
        <td>${boleta.telefono || ''}</td>
        <td>${boleta.metodoPago || ''}</td>
        <td>${boleta.comprobanteURL ? `<a href="${boleta.comprobanteURL}" target="_blank" rel="noopener">Ver</a>` : '—'}</td>
      `;

      const tdAcciones = document.createElement('td');
      tdAcciones.className = 'acciones-fila';

      if (boleta.estado === 'Reservada') {
        const btnPagado = document.createElement('button');
        btnPagado.className = 'btn btn-primario';
        btnPagado.textContent = 'Marcar pagado';
        btnPagado.addEventListener('click', () => marcarPagado(boleta.numero));
        tdAcciones.appendChild(btnPagado);
      }

      if (boleta.estado !== 'Disponible') {
        const btnLiberar = document.createElement('button');
        btnLiberar.className = 'btn btn-secundario';
        btnLiberar.textContent = 'Liberar';
        btnLiberar.addEventListener('click', () => liberarBoleta(boleta.numero));
        tdAcciones.appendChild(btnLiberar);
      }

      if (boleta.estado !== 'Disponible') {
        const inputArchivo = document.createElement('input');
        inputArchivo.type = 'file';
        inputArchivo.accept = 'image/*';
        inputArchivo.style.maxWidth = '110px';
        inputArchivo.addEventListener('change', (ev) => {
          const archivo = ev.target.files[0];
          if (archivo) adjuntarComprobante(boleta.numero, archivo);
        });
        tdAcciones.appendChild(inputArchivo);
      }

      tr.appendChild(tdAcciones);
      tbody.appendChild(tr);
    });
}

async function postAdmin(payload) {
  payload.codigoAdmin = getCodigoAdmin();
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function marcarPagado(numero) {
  const data = await postAdmin({ action: 'marcarPagado', numero });
  if (data.ok) cargarBoletasAdmin();
  else alert(data.error || 'No se pudo marcar como pagada');
}

async function liberarBoleta(numero) {
  if (!confirm(`¿Liberar la boleta ${numero}? Se perderán sus datos de reserva.`)) return;
  const data = await postAdmin({ action: 'liberarBoleta', numero });
  if (data.ok) cargarBoletasAdmin();
  else alert(data.error || 'No se pudo liberar la boleta');
}

async function adjuntarComprobante(numero, archivo) {
  const base64 = await comprimirImagenAdmin(archivo);
  const data = await postAdmin({ action: 'adjuntarComprobante', numero, comprobanteBase64: base64, nombreArchivo: archivo.name });
  if (data.ok) cargarBoletasAdmin();
  else alert(data.error || 'No se pudo adjuntar el comprobante');
}

async function onSubmitGanador(ev) {
  ev.preventDefault();
  const numero = document.getElementById('input-numero-ganador').value.trim();
  if (!numero) return;
  if (!confirm(`¿Declarar la boleta ${numero} como ganadora?`)) return;
  const data = await postAdmin({ action: 'declararGanador', numero });
  const mensaje = document.getElementById('mensaje-ganador');
  if (data.ok) {
    mensaje.textContent = `Boleta ganadora registrada: ${data.numeroGanador}`;
    mensaje.className = 'mensaje-estado exito';
  } else {
    mensaje.textContent = data.error || 'No se pudo registrar el ganador';
    mensaje.className = 'mensaje-estado error';
  }
}

function comprimirImagenAdmin(file, maxAncho = 1200, calidad = 0.65) {
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

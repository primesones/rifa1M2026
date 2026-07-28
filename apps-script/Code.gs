/**
 * Rifa1M - backend Apps Script.
 * Se despliega como Web App (Implementar > Nueva implementación > Aplicación web,
 * ejecutar como "Yo", acceso "Cualquier usuario").
 *
 * Hojas esperadas en el Spreadsheet vinculado:
 *  - "Boletas": Numero | Estado | Nombre | Telefono | MetodoPago | ComprobanteURL | FechaReserva | FechaPago | Notas
 *  - "Config":  Clave | Valor
 */

var HOJA_BOLETAS = 'Boletas';
var HOJA_CONFIG = 'Config';

var COL = {
  NUMERO: 1,
  ESTADO: 2,
  NOMBRE: 3,
  TELEFONO: 4,
  METODO_PAGO: 5,
  COMPROBANTE_URL: 6,
  FECHA_RESERVA: 7,
  FECHA_PAGO: 8,
  NOTAS: 9
};

var ESTADO = {
  DISPONIBLE: 'Disponible',
  RESERVADA: 'Reservada',
  PAGADA: 'Pagada'
};

// ---------------------------------------------------------------------------
// Configuración inicial (ejecutar una sola vez desde el editor de Apps Script)
// ---------------------------------------------------------------------------

function inicializarHojaBoletas() {
  var sh = getSheet_(HOJA_BOLETAS);
  sh.clear();
  sh.appendRow(['Numero', 'Estado', 'Nombre', 'Telefono', 'MetodoPago', 'ComprobanteURL', 'FechaReserva', 'FechaPago', 'Notas']);
  var filas = [];
  for (var i = 0; i < 100; i++) {
    var numero = (i < 10 ? '0' : '') + i;
    filas.push([numero, ESTADO.DISPONIBLE, '', '', '', '', '', '', '']);
  }
  // El formato de texto debe aplicarse ANTES de escribir los valores: si se
  // aplica después, "00" ya se convirtió a el número 0 y el cero se pierde.
  sh.getRange(2, 1, filas.length, 1).setNumberFormat('@');
  sh.getRange(2, 1, filas.length, filas[0].length).setValues(filas);
}

function inicializarConfig() {
  var sh = getSheet_(HOJA_CONFIG);
  sh.clear();
  sh.appendRow(['Clave', 'Valor']);
  sh.appendRow(['FechaSorteo', '2026-09-19']);
  sh.appendRow(['ValorBoleta', '55000']);
  sh.appendRow(['Loteria', 'Lotería del Cauca']);
  sh.appendRow(['Premio', '1000000']);
  sh.appendRow(['CarpetaDriveId', '']); // pegar aquí el ID de la carpeta de Drive para comprobantes
  sh.appendRow(['CodigoAdmin', 'CAMBIAR-ESTE-CODIGO']);
  sh.appendRow(['NumeroGanador', '']);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSheet_(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  return sh;
}

function getConfigMap_() {
  var sh = getSheet_(HOJA_CONFIG);
  var data = sh.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) map[data[i][0]] = data[i][1];
  }
  return map;
}

function setConfigValue_(clave, valor) {
  var sh = getSheet_(HOJA_CONFIG);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === clave) {
      sh.getRange(i + 1, 2).setValue(valor);
      return;
    }
  }
  sh.appendRow([clave, valor]);
}

// Google Sheets guarda como objeto Date cualquier celda que reconozca como fecha
// (aunque se haya escrito como texto "2026-09-19"). Sin esto, JSON.stringify la
// serializa como datetime completo y rompe el parseo de fecha en el frontend.
function normalizarValor_(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return valor;
}

function esAdminValido_(codigo) {
  var config = getConfigMap_();
  return !!codigo && String(codigo) === String(config.CodigoAdmin);
}

function encontrarFilaPorNumero_(sh, numero) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.NUMERO - 1]) === String(numero)) return i + 1; // fila 1-based
  }
  return -1;
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function subirComprobante_(numeroBoleta, base64, nombreArchivo) {
  var config = getConfigMap_();
  var carpetaId = config.CarpetaDriveId;
  if (!carpetaId) throw new Error('CarpetaDriveId no configurado en la hoja Config');
  var partes = base64.split(',');
  var contenido = partes.length > 1 ? partes[1] : partes[0];
  var mimeMatch = base64.match(/^data:([^;]+);/);
  var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  var blob = Utilities.newBlob(Utilities.base64Decode(contenido), mime, 'boleta-' + numeroBoleta + '-' + (nombreArchivo || 'comprobante.jpg'));
  var carpeta = DriveApp.getFolderById(carpetaId);
  var archivo = carpeta.createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return archivo.getUrl();
}

// ---------------------------------------------------------------------------
// doGet
// ---------------------------------------------------------------------------

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'getConfig') {
    var config = getConfigMap_();
    return responder_({
      ok: true,
      fechaSorteo: normalizarValor_(config.FechaSorteo),
      valorBoleta: config.ValorBoleta,
      loteria: config.Loteria,
      premio: config.Premio,
      numeroGanador: config.NumeroGanador
    });
  }

  if (action === 'getBoletas') {
    var sh = getSheet_(HOJA_BOLETAS);
    var data = sh.getDataRange().getValues();
    var boletas = [];
    for (var i = 1; i < data.length; i++) {
      boletas.push({
        numero: data[i][COL.NUMERO - 1],
        estado: data[i][COL.ESTADO - 1],
        metodoPago: data[i][COL.METODO_PAGO - 1]
      });
    }
    return responder_({ ok: true, boletas: boletas });
  }

  if (action === 'getBoletasAdmin') {
    if (!esAdminValido_(e.parameter.codigoAdmin)) {
      return responder_({ ok: false, error: 'Código de administrador inválido' });
    }
    var sh2 = getSheet_(HOJA_BOLETAS);
    var data2 = sh2.getDataRange().getValues();
    var boletas2 = [];
    for (var j = 1; j < data2.length; j++) {
      boletas2.push({
        numero: data2[j][COL.NUMERO - 1],
        estado: data2[j][COL.ESTADO - 1],
        nombre: data2[j][COL.NOMBRE - 1],
        telefono: data2[j][COL.TELEFONO - 1],
        metodoPago: data2[j][COL.METODO_PAGO - 1],
        comprobanteURL: data2[j][COL.COMPROBANTE_URL - 1],
        fechaReserva: normalizarValor_(data2[j][COL.FECHA_RESERVA - 1]),
        fechaPago: normalizarValor_(data2[j][COL.FECHA_PAGO - 1]),
        notas: data2[j][COL.NOTAS - 1]
      });
    }
    return responder_({ ok: true, boletas: boletas2 });
  }

  return responder_({ ok: false, error: 'Acción no reconocida' });
}

// ---------------------------------------------------------------------------
// doPost
// ---------------------------------------------------------------------------

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder_({ ok: false, error: 'Body inválido' });
  }

  switch (data.action) {
    case 'reservar':
      return accionReservar_(data);
    case 'adjuntarComprobante':
      return accionAdjuntarComprobante_(data);
    case 'marcarPagado':
      return accionMarcarPagado_(data);
    case 'liberarBoleta':
      return accionLiberarBoleta_(data);
    case 'declararGanador':
      return accionDeclararGanador_(data);
    default:
      return responder_({ ok: false, error: 'Acción no reconocida' });
  }
}

function accionReservar_(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return responder_({ ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos' });
  }

  try {
    var sh = getSheet_(HOJA_BOLETAS);
    var fila = encontrarFilaPorNumero_(sh, data.numero);
    if (fila === -1) return responder_({ ok: false, error: 'Número de boleta inválido' });

    var estadoActual = sh.getRange(fila, COL.ESTADO).getValue();
    if (estadoActual !== ESTADO.DISPONIBLE) {
      return responder_({ ok: false, error: 'Esa boleta ya no está disponible' });
    }

    var comprobanteURL = '';
    if (data.comprobanteBase64) {
      comprobanteURL = subirComprobante_(data.numero, data.comprobanteBase64, data.nombreArchivo);
    }

    sh.getRange(fila, COL.ESTADO).setValue(ESTADO.RESERVADA);
    sh.getRange(fila, COL.NOMBRE).setValue(data.nombre || '');
    sh.getRange(fila, COL.TELEFONO).setValue(data.telefono || '');
    sh.getRange(fila, COL.METODO_PAGO).setValue(data.metodoPago || '');
    if (comprobanteURL) sh.getRange(fila, COL.COMPROBANTE_URL).setValue(comprobanteURL);
    sh.getRange(fila, COL.FECHA_RESERVA).setValue(new Date());

    return responder_({ ok: true, numero: data.numero, estado: ESTADO.RESERVADA });
  } finally {
    lock.releaseLock();
  }
}

function accionAdjuntarComprobante_(data) {
  if (!esAdminValido_(data.codigoAdmin)) {
    return responder_({ ok: false, error: 'Código de administrador inválido' });
  }
  var sh = getSheet_(HOJA_BOLETAS);
  var fila = encontrarFilaPorNumero_(sh, data.numero);
  if (fila === -1) return responder_({ ok: false, error: 'Número de boleta inválido' });

  var comprobanteURL = subirComprobante_(data.numero, data.comprobanteBase64, data.nombreArchivo);
  sh.getRange(fila, COL.COMPROBANTE_URL).setValue(comprobanteURL);
  return responder_({ ok: true, numero: data.numero, comprobanteURL: comprobanteURL });
}

function accionMarcarPagado_(data) {
  if (!esAdminValido_(data.codigoAdmin)) {
    return responder_({ ok: false, error: 'Código de administrador inválido' });
  }
  var sh = getSheet_(HOJA_BOLETAS);
  var fila = encontrarFilaPorNumero_(sh, data.numero);
  if (fila === -1) return responder_({ ok: false, error: 'Número de boleta inválido' });

  sh.getRange(fila, COL.ESTADO).setValue(ESTADO.PAGADA);
  if (data.metodoPago) sh.getRange(fila, COL.METODO_PAGO).setValue(data.metodoPago);
  sh.getRange(fila, COL.FECHA_PAGO).setValue(new Date());
  return responder_({ ok: true, numero: data.numero, estado: ESTADO.PAGADA });
}

function accionLiberarBoleta_(data) {
  if (!esAdminValido_(data.codigoAdmin)) {
    return responder_({ ok: false, error: 'Código de administrador inválido' });
  }
  var sh = getSheet_(HOJA_BOLETAS);
  var fila = encontrarFilaPorNumero_(sh, data.numero);
  if (fila === -1) return responder_({ ok: false, error: 'Número de boleta inválido' });

  sh.getRange(fila, 1, 1, 9).setValues([[data.numero, ESTADO.DISPONIBLE, '', '', '', '', '', '', '']]);
  return responder_({ ok: true, numero: data.numero, estado: ESTADO.DISPONIBLE });
}

function accionDeclararGanador_(data) {
  if (!esAdminValido_(data.codigoAdmin)) {
    return responder_({ ok: false, error: 'Código de administrador inválido' });
  }
  setConfigValue_('NumeroGanador', data.numero);
  return responder_({ ok: true, numeroGanador: data.numero });
}

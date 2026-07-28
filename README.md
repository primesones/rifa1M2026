# Rifa 1M

Webapp gratuita para publicar y controlar el estado de las 100 boletas
(00-99) de la rifa. Sorteo: sábado 19 de septiembre de 2026, Lotería del
Cauca. Boleta: $55.000 COP. Premio: $1.000.000 COP.

- **Frontend**: sitio estático (`index.html` público + `admin.html` para
  la organizadora), hospedado gratis en GitHub Pages.
- **Datos**: un Google Sheet, con un Google Apps Script desplegado como
  Web App que hace de API entre el sitio y la hoja.
- **Comprobantes de pago**: se guardan en una carpeta de Google Drive.

Nada de esto tiene costo. Sigue estos pasos en orden — son cosas que solo
tú puedes hacer porque requieren tu cuenta de Google y de GitHub.

## 1. Crear el Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja de
   cálculo nueva, por ejemplo "Rifa 1M - Datos".
2. No hace falta crear las pestañas ni las columnas a mano: eso lo hace el
   script del paso 3.

## 2. Crear la carpeta de Drive para comprobantes

1. En [drive.google.com](https://drive.google.com) crea una carpeta, por
   ejemplo "Rifa 1M - Comprobantes".
2. Ábrela y copia el ID desde la URL:
   `https://drive.google.com/drive/folders/`**`ESTE_ES_EL_ID`**
3. Guarda ese ID, lo necesitas en el paso 4.

## 3. Crear el Apps Script

1. En el Google Sheet del paso 1: menú **Extensiones → Apps Script**.
2. Borra el contenido de `Code.gs` que aparece por defecto y pega todo el
   contenido de [`apps-script/Code.gs`](apps-script/Code.gs) de este
   repositorio.
3. Guarda el proyecto (ícono de disquete).
4. En el selector de funciones (junto al botón "Ejecutar"), elige
   `inicializarHojaBoletas` y presiona **Ejecutar**. La primera vez pedirá
   autorizar permisos (son tuyos, sobre tu propia hoja — acepta). Esto crea
   la pestaña `Boletas` con las 100 filas 00-99 en estado `Disponible`.
5. Repite lo mismo eligiendo `inicializarConfig` y ejecútala. Esto crea la
   pestaña `Config` con valores por defecto.
6. Ve a la hoja `Config` dentro del Sheet y ajusta:
   - `CarpetaDriveId`: pega el ID de la carpeta del paso 2.
   - `CodigoAdmin`: cámbialo por una clave que solo tú conozcas (es la que
     usarás para entrar a `admin.html`).
   - Revisa que `FechaSorteo`, `ValorBoleta`, `Loteria` y `Premio` tengan
     los valores correctos (ya vienen precargados con los de esta rifa).

## 4. Desplegar el Apps Script como Web App

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. "Ejecutar como": **Yo** (tu cuenta).
4. "Quién tiene acceso": **Cualquier usuario**.
5. Presiona **Implementar**, autoriza si te lo pide, y copia la URL que
   termina en `/exec`. Esa es la URL de tu API.

> Si más adelante modificas `Code.gs`, tienes que hacer
> **Implementar → Gestionar implementaciones → editar (lápiz) → Nueva versión → Implementar**
> para que los cambios se reflejen en esa misma URL.

## 5. Configurar el sitio

1. Abre `assets/config.js` en este repositorio.
2. Reemplaza el valor de `WEB_APP_URL` por la URL copiada en el paso
   anterior.

## 6. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (puede ser público o privado con
   GitHub Pro/Team; Pages gratis en repos públicos).
2. Sube todos los archivos de esta carpeta (`index.html`, `admin.html`,
   `assets/`, `apps-script/`, este `README.md`).
3. En el repo: **Settings → Pages → Source**: elige la rama `main` y
   carpeta `/ (root)`. Guarda.
4. En un par de minutos tu sitio queda disponible en
   `https://TU-USUARIO.github.io/TU-REPO/`.
5. Comparte esa URL para que la gente reserve boletas. La URL de
   `admin.html` (`.../admin.html`) no está enlazada desde ningún lado —
   solo la conoces tú, y además pide el `CodigoAdmin` del paso 3.

## Uso del día a día

- **Comprador**: entra al sitio, toca un número disponible (verde), llena
  nombre, teléfono, método de pago (Efectivo / Nequi / Bre-B) y,
  opcionalmente, adjunta una foto del comprobante. Queda en amarillo
  ("Reservada").
- **Administradora** (`admin.html`, con tu código): ves el detalle
  completo de cada boleta. Puedes:
  - **Marcar pagado**: pasa la boleta a rojo ("Pagada").
  - **Adjuntar comprobante**: útil para pagos en efectivo que no subieron
    foto al reservar.
  - **Liberar**: si alguien reservó y nunca pagó, vuelve la boleta a
    disponible.
  - **Declarar ganador**: al momento del sorteo, escribe el número
    ganador y se muestra un banner en el sitio público.

## Notas de seguridad

El código de administrador es un filtro simple, no una autenticación
fuerte (viaja en cada solicitud). Es suficiente para este caso de uso de
baja exposición (una sola administradora, montos pequeños), pero no lo
reutilices para nada más sensible.

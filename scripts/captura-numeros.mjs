// Genera una imagen PNG con la cabecera y la grilla de números disponibles
// del sitio público, para enviarla por Telegram (la gente no está entrando
// a la página, así que se divulga la imagen en su lugar).
//
// Uso: node scripts/captura-numeros.mjs [ruta-salida.png]

import { chromium } from 'playwright';
import sharp from 'sharp';

const URL_SITIO = process.env.URL_SITIO || 'https://primesones.github.io/rifa1M2026/';
const SALIDA = process.argv[2] || 'numeros-disponibles.png';
const ANCHO_VIEWPORT = 480;
const ESCALA = 2; // más nitidez al hacer zoom en el celular

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: ANCHO_VIEWPORT, height: 1200 },
    deviceScaleFactor: ESCALA
  });
  await page.emulateMedia({ colorScheme: 'light' });

  await page.goto(URL_SITIO, { waitUntil: 'networkidle' });

  // Espera a que la grilla tenga las 100 boletas (vienen de una llamada al
  // backend de Apps Script, no están en el HTML estático).
  await page.waitForFunction(
    () => document.querySelectorAll('#grilla .boleta').length === 100,
    { timeout: 30000 }
  );

  const header = page.locator('header.hero');
  const grilla = page.locator('#grilla');

  const cajaHeader = await header.boundingBox();
  const cajaGrilla = await grilla.boundingBox();
  if (!cajaHeader || !cajaGrilla) {
    throw new Error('No se pudo medir la cabecera o la grilla en la página.');
  }

  const arribaCss = cajaHeader.y;
  const abajoCss = cajaGrilla.y + cajaGrilla.height + 16; // pequeño margen inferior

  await page.screenshot({ path: 'captura-completa.png', fullPage: true });
  await browser.close();

  await sharp('captura-completa.png')
    .extract({
      left: 0,
      top: Math.round(arribaCss * ESCALA),
      width: Math.round(ANCHO_VIEWPORT * ESCALA),
      height: Math.round((abajoCss - arribaCss) * ESCALA)
    })
    .toFile(SALIDA);

  console.log(`Imagen generada: ${SALIDA}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

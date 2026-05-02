// ── Print helpers ──────────────────────────────────────────────────────────
// Opens a new window, writes the HTML content, and triggers print.

function triggerPrint(ventana) {
  // Esperar a que el documento cargue para evitar imprimir antes de renderizar (más fluido).
  const run = () => { ventana.focus(); ventana.print(); };
  if (ventana.document.readyState === 'complete') run();
  else ventana.addEventListener('load', run, { once: true });
}

export function abrirVentanaImpresion(htmlContent, width = 800, height = 1200) {
  const ventana = window.open('', '', `height=${height},width=${width}`);
  ventana.document.write(`
    <html>
      <head>
        <title>Impresión</title>
        <style>
          body { font-family: Helvetica, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          th { background-color: #f2f2f2; }
          h1, h2, h3 { text-align: center; }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `);
  ventana.document.close();
  triggerPrint(ventana);
}

export function abrirVentanaPOS(htmlContent) {
  const ventana = window.open('', '', 'height=900,width=300');
  ventana.document.write(`
    <html>
      <head>
        <title>Factura POS</title>
        <style>
          @page { margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #000 !important; -webkit-print-color-adjust: exact; }
          table { width: 100%; border-collapse: collapse; color: #000 !important; }
          th, td { padding: 2px 0; text-align: right; color: #000 !important; }
          th { text-align: center; }
          h2, h3, h4 { text-align: center; margin: 2px 0; color: #000 !important; }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `);
  ventana.document.close();
  triggerPrint(ventana);
}

// ── Invoice HTML templates ─────────────────────────────────────────────────

export function generarFacturaHTMLPDF({
  facturaId, nombreCliente, cedulaNit, telefonoCliente, correoCliente,
  direccionCliente, productosHTML, totalFactura, fechaActual,
}) {
  return `
    <div style="text-align: center; margin-bottom: 20px;">
      <h2>CompuServices Soft</h2>
      <p>Servicio técnico de computadores y celulares,<br> venta de computadores y periféricos</p>
      <div>
        <p style="margin: 0 0 4px 0;"><b>Factura:</b> ${facturaId}</p>
        <p style="margin: 0 0 4px 0;"><b>NIT:</b> 1193030552-4</p>
        <p style="margin: 0 0 4px 0;"><b>Celular:</b> 3242264795 - 3174034349</p>
        <p style="margin: 0;"><b>Ubicación:</b> Pasto, Centro comercial San Agustín, local 224A</p>
      </div>
    </div>
    <p><strong>Cliente:</strong> ${nombreCliente}</p>
    <p><strong>Cédula o NIT:</strong> ${cedulaNit}</p>
    ${telefonoCliente ? `<p><strong>Teléfono:</strong> ${telefonoCliente}</p>` : ''}
    ${correoCliente ? `<p><strong>Correo:</strong> ${correoCliente}</p>` : ''}
    ${direccionCliente ? `<p><strong>Dirección:</strong> ${direccionCliente}</p>` : ''}
    <p><strong>Fecha de Creación:</strong> ${fechaActual}</p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="border: 1px solid #ddd; padding: 8px;">Nombre</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Cantidad</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Precio Unitario</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Garantía</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Descripción</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${productosHTML}
        <tr style="background-color: #f2f2f2;">
          <td colspan="5" style="text-align: right; padding: 8px;"><strong>Total Factura:</strong></td>
          <td style="border: 1px solid #ddd; padding: 8px;">${totalFactura.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td>
        </tr>
      </tbody>
    </table>
    <p style="margin-top: 20px; font-size: 14px; color: #555;">
      <b>Nota:</b> La garantía cubre únicamente defectos de fabricación y no aplica en caso de insatisfacción personal, errores en la selección del producto, o daños causados por un mal uso. Para validar la garantía, es indispensable conservar todos los accesorios, empaques originales y documentación proporcionada en el momento de la compra.
    </p>
  `;
}

export function generarFacturaHTMLPOS({
  facturaId, nombreCliente, cedulaNit, telefonoCliente, correoCliente,
  direccionCliente, productosHTML, totalFactura, fechaActual,
}) {
  return `
    <div style="width: 68mm; font-size: 12px; font-family: Arial, Helvetica, sans-serif; color: #000">
      <h2 style="text-align: center; margin-bottom: 5px">CompuServices Soft</h2>
      <div style="font-size: 11px; text-align: center">
        <b>Servicio técnico de computadores y celulares, Venta de computadores y periféricos</b>
      </div>
      <div style="text-align: left; font-size: 12px; margin-top: 10px">
        <b>NIT:</b> 1193030552-4<br>
        <b>Celular:</b> 3242264795 - 3174034349<br>
        <b>Ubicación:</b> Pasto, Centro comercial San Agustín, local 224A<br>
        NO RESPONSABLES DE IVA
      </div>
      ${facturaId ? `<p style="margin-bottom: 0px"><strong>Factura N°:</strong> ${facturaId}</p>` : ''}
      <p style="margin-bottom: 0px"><strong>Fecha:</strong> ${fechaActual}</p>
      <p style="margin-bottom: 0px"><strong>Cliente:</strong> ${nombreCliente}</p>
      <p style="margin-bottom: 0px"><strong>Cédula/NIT:</strong> ${cedulaNit}</p>
      ${telefonoCliente ? `<p style="margin-bottom: 0px"><strong>Teléfono:</strong> ${telefonoCliente}</p>` : ''}
      ${correoCliente ? `<p style="margin-bottom: 0px"><strong>Correo:</strong> ${correoCliente}</p>` : ''}
      ${direccionCliente ? `<p style="margin-bottom: 0px"><strong>Dirección:</strong> ${direccionCliente}</p>` : ''}
      <hr style="border: 1px solid #000;">
      <table style="width: 100%; margin-top: 2px; font-size: 12px">
        <thead>
          <tr>
            <th style="padding: 2px 0; text-align: left;">Producto</th>
            <th style="text-align: center;">Ct.</th>
            <th style="text-align: center;">Pre.</th>
            <th style="text-align: center;">Garant.</th>
            <th style="text-align: center;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productosHTML}
          <tr style="font-weight: bold;">
            <td colspan="4" style="text-align: right; padding-top: 4px;">Total:</td>
            <td style="text-align: center; padding-top: 4px;">${totalFactura.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td>
          </tr>
        </tbody>
      </table>
      <hr style="border: 1px solid #000;">
      <p style="margin-top: 5px; font-size: 12px; text-align: center;"><b>****** Gracias por su Compra ******</b></p>
      <p style="margin-top: 1px; font-size: 12px; text-align: justify;">
        <b>Nota:</b> La garantía cubre únicamente defectos de fabricación y no aplica en caso de insatisfacción personal, errores en la selección del producto, o daños causados por un mal uso. Para validar la garantía, es indispensable conservar todos los accesorios, empaques originales y documentación proporcionada en el momento de la compra, como también no dañar los sellos de garantía este proceso puede demorar hasta 15 días hábiles.
      </p>
    </div>
  `;
}

export function generarPrestamoHTMLPDF({
  prestamoId, tipoDocumento, nombreCliente, cedulaNit, telefonoCliente,
  correoCliente, direccionCliente, productosHTML, totalPrestamo, totalAbonado,
  saldoPendiente, fechaActual, observaciones, abonosHTML,
}) {
  const tipoTexto = tipoDocumento === 'PRESTAMO' ? 'PRÉSTAMO' : 'APARTADO';
  const colorTipo = tipoDocumento === 'PRESTAMO' ? '#856404' : '#0c5460';
  return `
    <div style="text-align: center; margin-bottom: 20px;">
      <h2>CompuServices Soft</h2>
      <p>Servicio técnico de computadores y celulares,<br> venta de computadores y periféricos</p>
      <div>
        <p style="margin: 0 0 4px 0; color: ${colorTipo}; font-size: 18px;"><b>DOCUMENTO DE ${tipoTexto}</b></p>
        <p style="margin: 0 0 4px 0;"><b>${tipoTexto} N°:</b> ${prestamoId}</p>
        <p style="margin: 0 0 4px 0;"><b>NIT:</b> 1193030552-4</p>
        <p style="margin: 0 0 4px 0;"><b>Celular:</b> 3242264795 - 3174034349</p>
        <p style="margin: 0;"><b>Ubicación:</b> Pasto, Centro comercial San Agustín, local 224A</p>
      </div>
    </div>
    <p><strong>Cliente:</strong> ${nombreCliente}</p>
    <p><strong>Cédula o NIT:</strong> ${cedulaNit}</p>
    ${telefonoCliente ? `<p><strong>Teléfono:</strong> ${telefonoCliente}</p>` : ''}
    ${correoCliente ? `<p><strong>Correo:</strong> ${correoCliente}</p>` : ''}
    ${direccionCliente ? `<p><strong>Dirección:</strong> ${direccionCliente}</p>` : ''}
    <p><strong>Fecha:</strong> ${fechaActual}</p>
    ${observaciones ? `<p><strong>Observaciones:</strong> ${observaciones}</p>` : ''}
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="border:1px solid #ddd;padding:8px;">Nombre</th>
          <th style="border:1px solid #ddd;padding:8px;">Cantidad</th>
          <th style="border:1px solid #ddd;padding:8px;">Precio Unitario</th>
          <th style="border:1px solid #ddd;padding:8px;">Garantía</th>
          <th style="border:1px solid #ddd;padding:8px;">Descripción</th>
          <th style="border:1px solid #ddd;padding:8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${productosHTML}
        <tr style="background-color:#f2f2f2;">
          <td colspan="5" style="text-align:right;padding:8px;"><strong>Total ${tipoTexto}:</strong></td>
          <td style="border:1px solid #ddd;padding:8px;">${totalPrestamo.toLocaleString('es-CO',{minimumFractionDigits:0})}</td>
        </tr>
        <tr style="background-color:#d4edda;">
          <td colspan="5" style="text-align:right;padding:8px;"><strong>Total Abonado:</strong></td>
          <td style="border:1px solid #ddd;padding:8px;color:green;">${totalAbonado.toLocaleString('es-CO',{minimumFractionDigits:0})}</td>
        </tr>
        <tr style="background-color:#f8d7da;">
          <td colspan="5" style="text-align:right;padding:8px;"><strong>Saldo Pendiente:</strong></td>
          <td style="border:1px solid #ddd;padding:8px;color:red;font-weight:bold;">${saldoPendiente.toLocaleString('es-CO',{minimumFractionDigits:0})}</td>
        </tr>
      </tbody>
    </table>
    ${abonosHTML ? `
    <h4 style="margin-top:20px;">Historial de Abonos:</h4>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background-color:#f2f2f2;">
        <th style="border:1px solid #ddd;padding:6px;">Fecha</th>
        <th style="border:1px solid #ddd;padding:6px;">Monto</th>
        <th style="border:1px solid #ddd;padding:6px;">Cuenta</th>
        <th style="border:1px solid #ddd;padding:6px;">Observación</th>
      </tr></thead>
      <tbody>${abonosHTML}</tbody>
    </table>` : ''}
    <div style="margin-top:50px;text-align:center;">
      <div style="border-top:1px solid #000;width:200px;margin:0 auto;"></div>
      <p>Firma del Cliente</p>
    </div>
    <p style="margin-top:20px;font-size:14px;color:#555;">
      <b>Nota:</b> Este documento es un comprobante de ${tipoTexto.toLowerCase()}. El cliente se compromete a pagar el saldo pendiente en los plazos acordados.
    </p>
  `;
}

export function generarPrestamoHTMLPOS({
  prestamoId, tipoDocumento, nombreCliente, cedulaNit, telefonoCliente,
  productosHTML, totalPrestamo, totalAbonado, saldoPendiente, fechaActual, observaciones,
}) {
  const tipoTexto = tipoDocumento === 'PRESTAMO' ? 'PRÉSTAMO' : 'APARTADO';
  return `
    <div style="width:68mm;font-size:12px;font-family:Arial,Helvetica,sans-serif;color:#000">
      <h2 style="text-align:center;margin-bottom:5px">CompuServices Soft</h2>
      <div style="font-size:11px;text-align:center"><b>Servicio técnico de computadores y celulares, Venta de computadores y periféricos</b></div>
      <div style="text-align:left;font-size:12px;margin-top:10px">
        <b>NIT:</b> 1193030552-4<br>
        <b>Celular:</b> 3242264795 - 3174034349<br>
        <b>Ubicación:</b> Pasto, Centro comercial San Agustín, local 224A<br>
        NO RESPONSABLES DE IVA
      </div>
      <hr style="border:1px dashed #000;">
      <p style="text-align:center;margin:5px 0;font-weight:bold;font-size:14px;">DOCUMENTO DE ${tipoTexto}</p>
      <hr style="border:1px dashed #000;">
      <p style="margin-bottom:0px"><strong>${tipoTexto} N°:</strong> ${prestamoId}</p>
      <p style="margin-bottom:0px"><strong>Fecha:</strong> ${fechaActual}</p>
      <p style="margin-bottom:0px"><strong>Cliente:</strong> ${nombreCliente}</p>
      <p style="margin-bottom:0px"><strong>Cédula/NIT:</strong> ${cedulaNit}</p>
      ${telefonoCliente ? `<p style="margin-bottom:0px"><strong>Teléfono:</strong> ${telefonoCliente}</p>` : ''}
      ${observaciones ? `<p style="margin-bottom:0px"><strong>Obs:</strong> ${observaciones}</p>` : ''}
      <hr style="border:1px solid #000;">
      <table style="width:100%;margin-top:2px;font-size:12px">
        <thead><tr>
          <th style="padding:2px 0;text-align:left;">Producto</th>
          <th style="text-align:center;">Ct.</th>
          <th style="text-align:center;">Pre.</th>
          <th style="text-align:center;">Total</th>
        </tr></thead>
        <tbody>${productosHTML}</tbody>
      </table>
      <hr style="border:1px solid #000;">
      <table style="width:100%;font-size:12px;">
        <tr><td style="text-align:right;"><strong>Total:</strong></td><td style="text-align:right;">${totalPrestamo.toLocaleString('es-CO',{minimumFractionDigits:0})}</td></tr>
        <tr style="color:green;"><td style="text-align:right;"><strong>Abonado:</strong></td><td style="text-align:right;">${totalAbonado.toLocaleString('es-CO',{minimumFractionDigits:0})}</td></tr>
        <tr style="color:red;font-weight:bold;"><td style="text-align:right;"><strong>Pendiente:</strong></td><td style="text-align:right;">${saldoPendiente.toLocaleString('es-CO',{minimumFractionDigits:0})}</td></tr>
      </table>
      <hr style="border:1px solid #000;">
      <div style="margin-top:30px;text-align:center;">
        <div style="border-top:1px solid #000;width:150px;margin:0 auto;"></div>
        <p style="font-size:10px;">Firma del Cliente</p>
      </div>
      <p style="margin-top:5px;font-size:10px;text-align:center;"><b>****** Gracias por su Preferencia ******</b></p>
    </div>
  `;
}

export function generarAbonoHTMLPOS({
  prestamoId, tipoDocumento, nombreCliente, cedulaNit, montoAbono,
  cuentaRecaudo, observacion, totalPrestamo, totalAbonado, saldoPendiente,
  fechaAbono, numeroAbono,
}) {
  const tipoTexto = tipoDocumento === 'PRESTAMO' ? 'Préstamo' : 'Apartado';
  return `
    <div style="width:68mm;font-size:12px;font-family:Arial,Helvetica,sans-serif;color:#000">
      <h3 style="text-align:center;margin-bottom:5px">CompuServices Soft</h3>
      <p style="text-align:center;margin:0;font-size:10px;"><b>NIT:</b> 1193030552-4 | <b>Cel:</b> 3242264795</p>
      <hr style="border:1px dashed #000;">
      <p style="text-align:center;margin:5px 0;font-weight:bold;font-size:14px;">RECIBO DE ABONO #${numeroAbono}</p>
      <hr style="border:1px dashed #000;">
      <p style="margin-bottom:0px"><strong>${tipoTexto}:</strong> ${prestamoId}</p>
      <p style="margin-bottom:0px"><strong>Cliente:</strong> ${nombreCliente}</p>
      <p style="margin-bottom:0px"><strong>Cédula:</strong> ${cedulaNit}</p>
      <p style="margin-bottom:0px"><strong>Fecha:</strong> ${fechaAbono}</p>
      <p style="margin-bottom:0px"><strong>Cuenta:</strong> ${cuentaRecaudo || 'Efectivo'}</p>
      ${observacion ? `<p style="margin-bottom:0px"><strong>Obs:</strong> ${observacion}</p>` : ''}
      <hr style="border:1px solid #000;">
      <div style="text-align:center;padding:15px 0;background:#f5f5f5;margin:10px 0;">
        <p style="margin:0;font-size:10px;">MONTO ABONADO</p>
        <p style="margin:5px 0;font-size:24px;font-weight:bold;color:#28a745;">$${montoAbono.toLocaleString('es-CO')}</p>
      </div>
      <hr style="border:1px solid #000;">
      <table style="width:100%;font-size:11px;">
        <tr><td><strong>Total ${tipoTexto}:</strong></td><td style="text-align:right;">$${totalPrestamo.toLocaleString('es-CO')}</td></tr>
        <tr style="color:green;"><td><strong>Total Abonado:</strong></td><td style="text-align:right;">$${totalAbonado.toLocaleString('es-CO')}</td></tr>
        <tr style="color:red;font-weight:bold;"><td><strong>Saldo Pendiente:</strong></td><td style="text-align:right;">$${saldoPendiente.toLocaleString('es-CO')}</td></tr>
      </table>
      <hr style="border:1px dashed #000;">
      <p style="margin-top:5px;font-size:10px;text-align:center;"><b>****** Gracias por su Pago ******</b></p>
    </div>
  `;
}

export async function generarHTMLParaCodigos(cantidad, codigo) {
  const codigosHtml = Array.from({ length: cantidad }, (_, i) => `
    <div class="etiqueta">
      <div class="contenedor-barcode">
        <svg class="barcode" id="barcode-${i}"></svg>
      </div>
      <p class="codigo-texto">${codigo}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Imprimir Códigos de Barras</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <style>
      @page { margin: 0; size: auto; }
      html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; width: 100%; height: 100vh; }
      .etiqueta { width: 100%; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-after: always; padding: 0mm 2mm; }
      .contenedor-barcode { width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; flex: 1; }
      svg.barcode { width: 77%; height: auto; max-width: 100%; max-height: 90vh; }
      .codigo-texto { font-size: 8pt; font-weight: bold; margin: 0; padding: 0; text-align: center; }
    </style>
    </head><body>
    ${codigosHtml}
    <script>
      for (let i = 0; i < ${cantidad}; i++) {
        JsBarcode("#barcode-" + i, "${codigo}", { format:"CODE128", lineColor:"#000", width:2.3, height:70, displayValue:false, margin:1 });
      }
    </script>
    </body></html>`;
}

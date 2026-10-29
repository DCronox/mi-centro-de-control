# Mi Centro de Control

Aplicación personal instalable para organizar finanzas, rutinas, metas de ahorro y turnos.

## Funciones

- Dashboard, movimientos, tareas y rutinas, metas de ahorro e historial de turnos.
- Informes mensuales con categorías, comparativos, tendencia de seis meses y exportación CSV o impresión a PDF.
- Insights financieros con tendencias interactivas, distribución por categorías, flujo neto, metas, presupuestos, obligaciones y recomendaciones basadas en movimientos registrados.
- Presupuestos mensuales, obligaciones recurrentes, turnos programados y recordatorios próximos.
- Copias de seguridad locales y sincronización opcional entre dispositivos con Supabase.
- Recuperación de contraseña, eliminación de cuenta y páginas de privacidad, términos y cookies.

## Instalar en el móvil

1. Abre la dirección publicada en GitHub Pages desde el teléfono.
2. En Android, usa el menú del navegador y elige **Instalar aplicación** o **Añadir a pantalla de inicio**.
3. En iPhone, abre la página en Safari, toca **Compartir** y elige **Añadir a pantalla de inicio**.

La interfaz puede abrir sin conexión después de cargarla una vez. La sincronización entre dispositivos necesita internet y una cuenta de la aplicación.

Si abrías `index.html` directamente desde el disco y el importador no aparece, ejecuta `INICIAR_LOCAL.bat` y mantén abierta la ventana del servidor mientras usas la app. El lanzador no instala dependencias y solo sirve la aplicación en este equipo (`localhost`).

## Privacidad y publicación

Los registros personales se guardan localmente en el dispositivo y, si activas la sincronización, en la cuenta de Supabase configurada en la aplicación. No publiques nunca una clave secreta de Supabase en el código del navegador; aquí se usa una clave publicable.

Los avisos legales identifican a Estiben Caro, en Medellín, Colombia, y el contacto esticarored@gmail.com; la instancia de Supabase está alojada en us-east-1 (North Virginia). Revisa `FASE1_PENDIENTES.md` para conocer los pasos de configuración que siguen a cargo del propietario. Los archivos SQL incluidos se entregan como referencia y no se han ejecutado en Supabase.

## Insights y cálculos

Insights lee los mismos movimientos, metas y presupuestos que el resto de la app. Sus comparativos netean devoluciones y excluyen transferencias, pagos de tarjeta y movimientos anulados según las reglas de informes existentes. La proyección comprometida suma únicamente entradas y pagos pendientes ya registrados; no estima gastos variables ni trata turnos como ingresos confirmados. El neto histórico es flujo neto registrado, no saldo bancario ni patrimonio. Las obligaciones generadas ya aparecen como movimientos y se cuentan una sola vez.

La importación de extractos PDF de Nu procesa el texto en el dispositivo y requiere revisar y confirmar los movimientos antes de guardarlos. No realiza OCR ni envía el PDF a un servidor. Solo admite PDFs digitales sin contraseña; nunca solicita contraseñas bancarias. Abre la aplicación desde una dirección HTTPS o localhost; los navegadores no cargan los módulos necesarios cuando se abre directamente como `file://`.

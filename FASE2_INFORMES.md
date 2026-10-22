# Fase 2 — gráficas e informes

La sección **Informes** agrega:

- Gastos pagados agrupados por categoría para el mes seleccionado.
- Tendencia de gastos de seis meses, terminando en el periodo elegido.
- Comparación de ingresos recibidos y gastos pagados del mes.
- Variación de ingresos y gastos frente al mes anterior.
- Descarga de un archivo CSV con resumen y movimientos del periodo. Está codificado en UTF-8 con separador de punto y coma para abrirlo en Excel y otras hojas de cálculo.
- Vista de impresión del informe; desde el cuadro de impresión del dispositivo se puede elegir **Guardar como PDF**.

Los movimientos pendientes se cuentan y aparecen en el CSV, pero no se suman a los totales realizados. Los informes usan los mismos estados de pago que el dashboard. Los datos se calculan dentro del navegador y no se envían a otro servicio para generar los gráficos o archivos.

La descarga ofrecida es CSV compatible con Excel, no un archivo XLSX nativo. Para crear un PDF, el navegador o el sistema debe ofrecer la opción de guardar/imprimir como PDF.

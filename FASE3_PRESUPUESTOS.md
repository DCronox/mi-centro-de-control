# Fase 3 — presupuestos e insights

- Los presupuestos se guardan por categoría y se aplican a cada mes.
- La barra compara cada límite con los gastos pagados de esa categoría en el mes actual.
- Al cruzar el 80 % o el 100 % mientras se registra o se marca pagado un gasto, aparece un aviso en la aplicación. El estado también queda visible en el dashboard mientras el presupuesto esté por encima de esos umbrales.
- El dashboard compara los gastos por categoría con los mismos días del mes anterior, muestra cuánto falta para la meta de ahorro más cercana y proyecta el ahorro neto al cierre del mes.

La proyección es lineal: (ingresos recibidos − gastos pagados hasta hoy) dividido por días transcurridos, multiplicado por los días del mes. No incluye saldo inicial y no es una garantía del resultado. Los avisos son dentro de la aplicación mientras está abierta; las notificaciones cuando está cerrada corresponden a la Fase 4.

El campo de presupuestos forma parte de los datos guardados y de las copias JSON. Las copias antiguas sin este campo se cargan con una lista vacía de presupuestos.

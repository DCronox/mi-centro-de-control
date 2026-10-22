# Fase 4 — automatización

- Las obligaciones mensuales se configuran desde Movimientos con nombre, valor, categoría y día. Al iniciar o volver a abrir la app se genera como máximo un gasto pendiente por obligación en el mes actual. El día se ajusta al último día del mes cuando el mes es más corto. Pausar detiene futuras generaciones; borrar la regla conserva los movimientos ya generados.
- El dashboard muestra los pagos pendientes vencidos y los que vencen en los próximos siete días, además de los turnos programados próximos.
- En Turnos se pueden programar fecha, horario y descanso. Al llegar la fecha, el turno se puede registrar en el historial; cancelarlo no borra otros registros.
- Las copias JSON ya existentes incluyen el estado completo. Las copias antiguas se importan con listas vacías para los campos nuevos.

**Límite de ejecución:** la app no tiene un servidor ni un servicio push. Por eso las obligaciones se crean y los recordatorios se actualizan cuando la app está abierta o vuelve a abrirse; no se ejecutan con la app cerrada y no generan notificaciones del sistema.

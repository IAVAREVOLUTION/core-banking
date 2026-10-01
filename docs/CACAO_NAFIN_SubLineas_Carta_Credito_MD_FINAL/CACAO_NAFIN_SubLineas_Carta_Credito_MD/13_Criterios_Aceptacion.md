# 13 — Criterios de Aceptación

## Configuración
### CA-01
La Línea Global sólo muestra en Nueva Disposición los productos hijo relacionados en Productos Disposición.

### CA-02
Automática puede configurarse sin fases.

### CA-03
Selectiva puede configurarse con exactamente 5 fases y máximo 2 requisitos por fase para la demo.

## Creación
### CA-04
Crear una Disposición genera una Solicitud y NO consume disponible.

### CA-05
Monto Solicitado corresponde al Monto de la Carta.

## Automática
### CA-06
Si cumple todas las reglas, se activa sin fases.

### CA-07
Si falla una regla, se rechaza y muestra el detalle de incumplimiento.

### CA-08
No se convierte automáticamente a Selectiva.

## Selectiva
### CA-09
La Solicitud recorre F1-F5.

### CA-10
Cada fase valida requisitos y pantallas antes de autorizar.

### CA-11
Los cargos configurados se generan usando el mecanismo existente.

## Activación
### CA-12
Al activar:
- Monto Contingente = Monto Garantizado
- Disponible Global disminuye por Monto Garantizado
- Estatus = ACTIVA

### CA-13
Si el Disponible cambió durante Originación y ya no alcanza, la activación debe bloquearse.

### CA-14
La activación debe ser transaccional.

## Liberación
### CA-15
Al vencer sin reclamo, el saldo garantizado liberable regresa al Disponible de la Línea Global.

## Reclamación
### CA-16
El monto reclamable no supera `MIN(SaldoElegible × %Cobertura, SaldoGarantizado)`.

## Pago
### CA-17
El pago procedente se dirige al Intermediario Financiero usando Cuentas Beneficiarias.

## Recuperación
### CA-18
Las recuperaciones quedan asociadas a la SubLínea y a la Reclamación/Pago correspondiente.

## No regresión
### CA-19
BANOBRAS y otros productos continúan funcionando sin cambios funcionales.

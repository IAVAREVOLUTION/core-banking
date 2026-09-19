# HU — REQ-25: Usuario DEMO con módulos acotados

> **Origen:** solicitud del 03/09/2026 (Jorge Ríos): un acceso `DEMO/DEMO` que
> sólo vea nueve módulos, para enseñar el flujo de 2º Piso sin las 25 entradas
> del menú completo.

---

## Requerimiento original (transcripción)

> DEMO/DEMO — ese que sólo pueda ver los módulos de Prospectos, Cotizaciones,
> Oportunidades, Solicitudes, Solicitudes Activación, Banca 2º Piso, Cartera
> Crédito 2º Piso, Cobranza y Pólizas Contables.

---

## Contexto técnico (verificado)

| Pieza | Estado |
|---|---|
| Autenticación | Comparación directa `admin/admin` en [LoginScreen.tsx:33](../src/app/components/LoginScreen.tsx#L33). No hay backend de sesión. |
| Menú | Un solo arreglo `navigationTabs` en [App.tsx:699](../src/app/App.tsx#L699), consumido en [:868](../src/app/App.tsx#L868). |
| Módulo activo | `useState<Module>('dashboard')` en [App.tsx:91](../src/app/App.tsx#L91). |
| Modelo de usuarios | **No existe.** `currentUser` es un objeto fijo en `mockData.ts` que firma votos, notas y documentos. |

---

## ⚠️ Alcance real: es una restricción de INTERFAZ, no de seguridad

Todas las llamadas a Supabase usan la misma `publicAnonKey`, para cualquier
usuario. Un DEMO seguiría pudiendo leer y escribir cualquier tabla desde la
consola del navegador.

**Para lo que sirve:** acotar una demostración comercial a un flujo concreto.
**Para lo que NO sirve:** impedir que alguien externo toque el resto del sistema.
Eso exige autenticación real de Supabase y políticas RLS — otro tamaño de trabajo.

Queda declarado aquí para que nadie asuma una garantía que el sistema no da.

---

## Historia de usuario

> **Como** responsable de la demostración
> **quiero** un acceso DEMO que sólo muestre los módulos del flujo de 2º Piso
> **para** presentar el proceso sin distraer con módulos que no vienen al caso.

| CA | Criterio de aceptación |
|---|---|
| CA-01 | `DEMO/DEMO` (sin distinguir mayúsculas) inicia sesión. |
| CA-02 | Su menú muestra **sólo**: Prospectos, Cotizaciones, Oportunidades, Solicitudes, Sol. Activación, Banca 2º Piso, Cartera de Crédito 2º Piso, Cobranza y Pólizas Contables. |
| CA-03 | `admin/admin` **no cambia**: sigue viendo todo. |
| CA-04 | Si el módulo activo no está permitido, se cae al primero permitido — filtrar el menú **esconde**, no **restringe**. |
| CA-05 | El acceso DEMO no aparece anunciado en la pantalla de login junto a las credenciales de prueba. |
| CA-06 | Un perfil sin lista de módulos tiene acceso completo (comportamiento previo). |

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | La lista de módulos permitidos vive en el perfil del usuario, no dispersa en cada componente. |
| RN-02 | Ocultar del menú no basta: el render debe negar el módulo no permitido (CA-04). |
| RN-03 | Ausencia de lista significa "sin restricción", para que agregar el perfil no altere a los usuarios existentes. |

---

## Fuera de alcance

- Autenticación real / RLS (ver §Alcance).
- Que DEMO firme documentos, votos y notas con su propio nombre: requiere
  conectar `currentUser`, que hoy es un objeto fijo compartido por todo el
  sistema. Se deja anotado como paso siguiente.

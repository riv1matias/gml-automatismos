# Portal GML Contables

Portal interno de socios. Primer módulo: **Automatismo Comprobantes** (genera el
archivo final de compras a partir del export crudo de AFIP). Pensado para crecer
en módulos ("Automatismo X", "Automatismo Y") sin tocar lo ya construido.

Stack: **Next.js 14 (App Router) + Supabase (Auth, Postgres, Storage) + Vercel**.

## 1. Crear el proyecto en Supabase

1. Crear un proyecto nuevo en https://supabase.com.
2. Ir a **SQL Editor** y correr el contenido de `supabase/migrations/0001_init.sql`.
   Esto crea:
   - tabla `profiles` (socios, 1 solo rol por ahora, con `force_password_change`)
   - tabla `modules` (hoy solo "comprobantes")
   - tabla `base_file_versions` (Proveedores / Plantilla, versionadas)
   - tabla `comprobantes_runs` (cada corrida del automatismo, versionada por período)
   - tabla `audit_log` (login, altas, subidas, procesos, descargas — quién y cuándo)
   - trigger que crea el `profile` automáticamente cuando se crea un usuario en `auth.users`
   - buckets de Storage `base-files` y `comprobantes` (privados)
3. Ir a **Authentication > Providers** y dejar habilitado Email/Password
   (es lo único que usa el portal).
4. Ir a **Project Settings > API** y copiar:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡nunca la expongas al cliente!)

## 2. Crear el primer socio (admin)

Como pediste, el alta es manual la primera vez, desde el propio Supabase:

1. **Authentication > Users > Add user** → creá tu usuario con tu email y una
   contraseña (marcá "Auto Confirm User").
2. Entrá al portal con ese usuario. Como el trigger de la migración crea el
   `profile` con `force_password_change = true` por defecto, el portal te va a
   pedir cambiar la contraseña en el primer ingreso.
3. Desde ahí, en **Socios** (menú lateral) ya podés dar de alta a los demás
   socios: quedan con la contraseña temporal `12345678` y el sistema les va a
   pedir cambiarla al entrar. Lo mismo pasa si le "blanqueás" la clave a alguien.

No hay roles distintos: cualquier socio logueado puede dar de alta a otro socio,
subir archivos base y procesar comprobantes.

## 3. Variables de entorno

Copiá `.env.example` a `.env.local` (para desarrollo local) y completá con los
valores del paso 1. En Vercel, cargá las mismas 3 variables en
**Project Settings > Environment Variables**.

## 4. Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te redirige a `/login`.

## 5. Deploy a Vercel

1. Subí este proyecto a un repo de GitHub/GitLab.
2. En Vercel: **New Project** → importá el repo.
3. Cargá las 3 variables de entorno del paso 3.
4. Deploy. Como el framework es Next.js, Vercel detecta todo solo.

## 6. Primeros pasos ya en producción

1. Entrar con el usuario admin creado en el paso 2.
2. Ir a **Archivos base** y subir la primera versión de **Plantilla** y de
   **Proveedores** (los `.xlsx` que ya vienen usando).
3. Ir a **Automatismo Comprobantes**, indicar el período (`AAAAMM`) y subir el
   comprobante crudo de AFIP (`.csv` o `.xlsx`) para procesarlo.
4. El archivo final queda disponible para descargar ahí mismo y en
   **Automatismo Comprobantes > Ver historial completo**.

## Cómo está organizado el código

```
app/
  login/                      pantalla de login
  change-password/            cambio de contraseña forzado (primer ingreso / blanqueo)
  (dashboard)/                todo lo que necesita sesión activa
    comprobantes/              módulo Automatismo Comprobantes
      historial/               historial completo de corridas
    archivos-base/             gestión de Proveedores / Plantilla (versionado)
    usuarios/                  alta de socios + blanqueo de contraseña
  api/
    admin/                     alta de socio, blanqueo de contraseña (usa service role)
    auth/                      logging de login / cambio de contraseña
    base-files/                subir nueva versión de archivo base / reactivar una anterior
    comprobantes/               procesar un comprobante crudo / descargar el resultado

lib/
  supabase/
    client.ts                  cliente para Client Components (anon key)
    server.ts                  cliente para Server Components / Route Handlers (cookies de sesión)
    admin.ts                   cliente con service role (SOLO server-side: storage + alta de usuarios)
  transform/
    types.ts                   tipos del motor de mapeo
    parseRaw.ts                parsea el crudo de AFIP (.csv o .xlsx) a RawRecord[]
    mapping.ts                 TODAS las reglas de negocio confirmadas (ver comentario en el archivo)
    buildWorkbook.ts           genera el .xlsx final (hoja RawAFIP + Comprobantes con fórmulas + Proveedores)
  audit.ts                     helper para escribir en audit_log

supabase/migrations/0001_init.sql   esquema completo (tablas, RLS, triggers, buckets)
```

## Agregar un módulo nuevo el día de mañana

1. Insertar una fila en `modules` (código, nombre, descripción).
2. Crear la carpeta `app/(dashboard)/<codigo-modulo>/`.
3. Si necesita su propio historial/versionado, replicar el patrón de
   `comprobantes_runs` (una tabla con `version_number`, `processed_by`,
   `processed_at`, `status`, y su `storage_path` de salida).
4. Sumar el link en `components/Sidebar.tsx` (`MODULES`).

No hace falta tocar auth, ni el manejo de socios, ni archivos base: son
transversales a todos los módulos.

## Reglas de negocio del motor de Comprobantes (resumen)

Documentadas en detalle como comentario en `lib/transform/mapping.ts`. En criollo:

- Fecha / Sucursal / Nº Comprobante / Proveedor (CUIT) / Tipo de Comprobante:
  copia directa del crudo de AFIP.
- CondCompra=0, ClasificacionCF=3, ImputacionCF=1, RegimenPercIVA=493: constantes.
- Moneda y Cotización: siempre vacías (los importes en USD ya vienen convertidos
  a pesos en el export de AFIP).
- NG / IVA por tasa (21/27/10,5/5/2,5%): columna a columna, 1 a 1.
- Exento: si la factura no discrimina IVA en ningún lado (Factura C /
  monotributista), se usa el Importe Total completo. Si discrimina, el Importe
  Exento tal cual viene.
- NoAlcanzado: suma de Importe No Gravado + Per./Pagos Cta Otros Imp. Nac. +
  Imp. Municipales + Imp. Internos + Otros Tributos.
- PercepcionesIG, PercepcionesBP, CAI/CAE/COE y su vencimiento: siempre vacíos
  (no hay dato equivalente en el export de AFIP).
- Cada corrida valida que el total calculado cierre contra el Importe Total del
  crudo; si no cierra (ej. algunas facturas de compañías de seguros), la fila
  queda marcada como aviso para revisar a mano, pero no bloquea el resto del
  procesamiento.

Si en algún momento cambia alguna de estas reglas, es el único archivo que hay
que tocar — el resto del sistema (parseo, generación del Excel, storage,
auditoría) no sabe nada de reglas de negocio.

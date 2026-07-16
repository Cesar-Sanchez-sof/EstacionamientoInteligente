# 🚗 Estacionamiento Inteligente (Smart Parking)

Estacionamiento Inteligente es una plataforma web PWA full-stack de última generación diseñada para la gestión, reserva y visualización interactiva de plazas de estacionamiento en tiempo real, integrada directamente con un sistema físico controlado por **dos microcontroladores ESP32 (uno principal de 38 pines y otro secundario de 30 pines)**.

Orientada a brindar una experiencia de usuario (UX) sumamente fluida y visualmente impactante, la aplicación destaca por integrar un **croquis tridimensional interactivo (3D)** de la playa de estacionamiento, un panel administrativo de **control de accesos RFID de usuarios** y un módulo con **estadísticas y reportes de uso dinámicos en tiempo real**.

---

## 🎨 Filosofía de Diseño y UX/UI

La interfaz de usuario ha sido concebida bajo principios de **Diseño Futurista e Inmersivo**:
* **Estética Dark Mode & Neon**: Paleta basada en tonos pizarra oscuros (`slate-900` / `gray-900`) con acentos en colores neón de alta luminancia (Cyan para realces de interfaz y reservas propias, Verde Neón para disponibilidad y Rojo Vibrante para ocupado/alerta).
* **Glassmorphism**: Paneles de información semitransparentes con efectos de desenfoque de fondo (`backdrop-blur`) y bordes sutiles que generan sensación de profundidad.
* **Micro-interacciones tridimensionales**: El mapa de estacionamiento 3D permite rotación orbital, paneo y zoom fluidos mediante gestos táctiles o de mouse (`OrbitControls`), reaccionando instantáneamente al hacer clic sobre una plaza libre para iniciar el proceso de reserva.

---

## 🚀 Características Principales

### Para los Usuarios (Clientes)
1. **Visualización 3D Interactiva**: Renderizado tridimensional en tiempo real del estacionamiento, diferenciando estados por colores:
   * 🟢 **Verde**: Disponible físicamente y sin reservas activas.
   * 🔴 **Rojo**: Ocupado físicamente (sensor activo) o reservado por otro usuario.
   * 🔵 **Azul**: Reservado por el usuario logueado en la sesión.
2. **Reservas Flexibles**: Permite seleccionar una plaza desde el mapa 3D y agendarla especificando fecha y hora.
3. **Gestión de Vehículos**: Vinculación de la placa vehicular obligatoria al registrarse.
4. **Sincronización en Tiempo Real**: Consulta periódica automática (polling cada 10 segundos) para mantener la disponibilidad actualizada sin refrescar la página.

### Para Administradores (IoT & Gestión)
1. **Control de Espacios Físicos (Simulación de Sensores)**: Un panel interactivo que permite alternar el estado físico de los cajones (`OCUPADO` / `LIBRE`), simulando la telemetría del sensor físico.
2. **Control Remoto de Barreras (Doble Acceso)**: Interfaz para abrir de forma remota e independiente la **Barrera de Entrada** (ID 1) y la **Barrera de Salida** (ID 2) con auto-cierre en 5 segundos.
3. **Historial de Actividad de Sensores (IoT)**: Registro dinámico que muestra en tiempo real cuándo ingresa o sale un vehículo de cada cajón, con marcas de tiempo formateadas.
4. **Reporte de Uso en Tiempo Real (Base 24h)**: Muestra el total de horas ocupadas, horas libres (sumando siempre 24.0h) y el porcentaje de utilización diaria de forma dinámica (polling cada 2.5s).
5. **Autos Estacionados**: Cuenta e informa la cantidad de usos físicos y vehículos detectados por los sensores FC-51 a lo largo de la fecha consultada.

---

## 🛠️ Stack Tecnológico

El proyecto está dividido en tres áreas de desarrollo:

### Frontend (PWA)
* **Framework & Builder**: React 19 + Vite.
* **Estilos**: Tailwind CSS v4.
* **Modelado 3D**: Three.js, `@react-three/fiber` y `@react-three/drei`.
* **Gestión de Estado**: Zustand (gestión ligera del estado de autenticación y token).
* **Visualización de Datos**: Recharts (gráficos responsivos).
* **Soporte Offline/PWA**: Configurado mediante `vite-plugin-pwa`.

### Backend
* **Entorno de Ejecución**: Node.js con Express v5.
* **Base de Datos**: PostgreSQL (Base de datos relacional robusta).
* **Seguridad**: JWT (Tokens de acceso para autenticación) y Bcrypt (encriptación de contraseñas).
* **Controladores de Base de Datos**: Módulo `pg` (Pool de conexiones).

### Hardware / IoT
* **Microcontrolador**: ESP32 NodeMCU (38 pines).
* **Sensores**: Sensor de proximidad infrarrojo FC-51 (obstáculos) y Lector RFID RC522 (tarjetas de acceso).
* **Actuadores**: Micro Servomotores SG90 (barreras físicas).
* **Visualización**: Pantalla LCD 16x2 con adaptador I2C (PCF8574).

---

## 📡 Integración de Hardware & Configuración de Pines

El sistema físico se distribuye en **dos placas de desarrollo ESP32 independientes** que interactúan directamente con la API web del servidor mediante consultas seguras HTTPS. Ambas placas emplean una arquitectura **Multitarea de Doble Núcleo (FreeRTOS)** para optimizar el rendimiento y evitar latencias físicas:
* **Core 0 (Hilo de Red - Background)**: Realiza consultas HTTPS lentas al servidor (comprobando estado de barreras remotas cada 1.5s y estado de cajones cada 5s) sin bloquear las lecturas físicas.
* **Core 1 (Hilo Principal - Loop Físico)**: Lee instantáneamente las tarjetas RFID, maneja los servomotores al instante al detectar tarjetas o autos, y actualiza la pantalla y LEDs.

---

### 1️⃣ ESP32 Principal (38 Pines) - Control de Entrada y Cajones
Esta placa está a cargo de gestionar el acceso en la barrera de entrada, el conteo total de cupos en el LCD, los 10 sensores de cajones individuales y la tira de 20 LEDs NeoPixel.

#### 📋 Tabla de Conexión de Pines (ESP32 de 38 Pines)

| Componente | Pin ESP32 (GPIO) | Función / Señal | Descripción |
|---|---|---|---|
| **Pantalla LCD 16x2 I2C** | GPIO 21 | SDA | Línea de datos I2C |
| | GPIO 22 | SCL | Línea de reloj I2C |
| | VCC (5V) | Alimentación | Energía 5V (desde la fuente externa) |
| | GND | Tierra | Conexión a tierra común |
| **Lector RFID MFRC522 (Entrada)** | GPIO 5 | SDA / SS | Select Pin (SPI SS) |
| | GPIO 4 | RST | Reset Pin |
| | GPIO 18 | SCK | SPI Clock |
| | GPIO 19 | MISO | SPI Master Input Slave Output |
| | GPIO 23 | MOSI | SPI Master Output Slave Input |
| | 3.3V | Alimentación | Energía 3.3V (desde ESP32 o regulador externo) |
| | GND | Tierra | Conexión a tierra común |
| **Servomotor Entrada** | GPIO 13 | PWM / Señal | Control de la Barrera de Entrada (Cerrado=90°, Abierto=0°) |
| | VCC (5V) | Alimentación | Energía 5V (desde la fuente externa) |
| | GND | Tierra | Conexión a tierra común |
| **Tira NeoPixel (20 LEDs)**| GPIO 15 | DIN / Datos | Señal de datos para WS2812B (2 LEDs por cajón) |
| | VCC (5V) | Alimentación | Energía 5V (desde la fuente externa) |
| | GND | Tierra | Conexión a tierra común |
| **FC-51 Entrada (Paso)** | GPIO 16 | OUT | Sensor de detección en la Barrera de Entrada |
| **FC-51 Cajón #1** | GPIO 25 | OUT | Sensor de presencia física del Cajón 1 |
| **FC-51 Cajón #2** | GPIO 26 | OUT | Sensor de presencia física del Cajón 2 |
| **FC-51 Cajón #3** | GPIO 27 | OUT | Sensor de presencia física del Cajón 3 |
| **FC-51 Cajón #4** | GPIO 32 | OUT | Sensor de presencia física del Cajón 4 |
| **FC-51 Cajón #5** | GPIO 33 | OUT | Sensor de presencia física del Cajón 5 |
| **FC-51 Cajón #6** | GPIO 34 | OUT | Sensor de presencia física del Cajón 6 |
| **FC-51 Cajón #7** | GPIO 35 | OUT | Sensor de presencia física del Cajón 7 |
| **FC-51 Cajón #8** | GPIO 36 | OUT | Sensor de presencia física del Cajón 8 |
| **FC-51 Cajón #9** | GPIO 39 | OUT | Sensor de presencia física del Cajón 9 |
| **FC-51 Cajón #10** | GPIO 12 | OUT | Sensor de presencia física del Cajón 10 |

---

### 2️⃣ ESP32 Secundario (30 Pines) - Control de la Barrera de Salida
Esta placa está dedicada exclusivamente a gestionar la salida de vehículos del estacionamiento validando su tarjeta autorizada RFID.

#### 📋 Tabla de Conexión de Pines (ESP32 de 30 Pines)

| Componente | Pin ESP32 (GPIO) | Función / Señal | Descripción |
|---|---|---|---|
| **Lector RFID MFRC522 (Salida)** | GPIO 5 | SDA / SS | Select Pin (SPI SS) |
| | GPIO 4 | RST | Reset Pin |
| | GPIO 18 | SCK | SPI Clock |
| | GPIO 19 | MISO | SPI Master Input Slave Output |
| | GPIO 23 | MOSI | SPI Master Output Slave Input |
| | 3.3V | Alimentación | Energía 3.3V (desde ESP32 o regulador externo) |
| | GND | Tierra | Conexión a tierra común |
| **Servomotor Salida** | GPIO 13 | PWM / Señal | Control de la Barrera de Salida (Cerrado=0°, Abierto=90°) |
| | VCC (5V) | Alimentación | Energía 5V (desde la fuente externa) |
| | GND | Tierra | Conexión a tierra común |
| **FC-51 Salida (Paso)** | GPIO 16 | OUT | Sensor de detección en la Barrera de Salida |

---

## ⚡ Lógicas del Sistema y Optimizaciones Aplicadas

### 1. Estabilización Eléctrica y Bypass de BOD (ESP32)
* **Bypass de Brownout Detector (BOD):** Para evitar que el microcontrolador se reinicie debido a las caídas menores de tensión momentáneas al activar los servomotores SG90, se ha deshabilitado el detector de Brownout del ESP32 por software en el `setup()` mediante:
  `WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);`
* **Fuente Externa:** Se utiliza una **Fuente de Poder Switching de 220V AC a 5V DC de 10A (50W)** para suplir la corriente del microcontrolador, los 12 sensores FC-51, las barreras y la tira LED NeoPixel, aislando la carga eléctrica del ESP32 de perturbaciones.

### 2. Estabilización de RFID (Heartbeat & Ganancia)
* **Heartbeat de Inactividad (4s):** El lector RC522 tiende a congelarse o bloquear el bus SPI tras largos periodos de inactividad o perturbaciones eléctricas. El código ejecuta una re-inicialización del lector (`rfid.PCD_Init()`) cada **4 segundos de inactividad**, recuperando la comunicación automáticamente.
* **Máxima Sensibilidad:** Al iniciar y re-inicializar el RFID, se configura la ganancia de antena al máximo (`MFRC522::RxGain_max` = 48dB), aumentando el rango y asegurando lecturas instantáneas de tarjetas y llaveros.

### 3. Seguridad: Control de Sesión Única (Single Session)
* El backend incluye la columna `token_version` en la base de datos de usuarios. Cada inicio de sesión incrementa esta versión.
* El middleware del backend compara el token del cliente con la versión actual de la base de datos. Si se inicia sesión en un nuevo dispositivo, la sesión anterior es invalidada inmediatamente (HTTP 401).
* El cliente cuenta con un interceptor en Axios que detecta el vencimiento del token e inicia el `logout` inmediato en la pantalla.

### 4. Lógica de Reservas y Bloqueo Inteligente
* **Bloqueo por Capacidad Física:** Si los sensores detectan que el estacionamiento cuenta con **5 o más cajones ocupados físicamente**, el sistema bloquea automáticamente la creación de nuevas reservas (tanto en backend como en frontend), devolviendo un error controlado al usuario. Las reservas se habilitan automáticamente en cuanto un vehículo se retira.
* **Deselección en Tiempo Real:** Si un usuario tiene abierta la vista de reserva en el mapa 3D y otro vehículo se estaciona físicamente en la plaza seleccionada, el frontend deselecciona la plaza en tiempo real y notifica al usuario del cambio.

### 5. Algoritmo de Máquina de Estados para Reportes de Uso
* El backend procesa los reportes utilizando una máquina de estados limpia:
  * **Fijación de 24 horas:** El tiempo total se calcula sobre una base de 24 horas (`86,400,000` ms). Tiempo ocupado + Tiempo libre = 24.0h.
  * **Límite al Tiempo Actual:** Si se consulta el día actual en curso, el sistema calcula la ocupación hasta la hora actual (`now`) en lugar de proyectar a futuro (medianoche), evitando reportes erróneos.
  * **Filtro de Rebotes:** Filtra eventos duplicados consecutivos (`INGRESO` o `SALIDA` re    DOCUMENTO ||--o{ PERSONA : "identifica"
    PERSONA ||--|| USUARIO : "es"
    PERSONA ||--o{ VEHICULO : "posee"
    USUARIO ||--o{ RESERVA : "realiza"
    LUGAR ||--o{ RESERVA : "contiene"
    VEHICULO ||--o{ RESERVA : "se asigna a"
    LUGAR ||--o{ REGISTRO_VEHICULAR : "registra actividad"
    BARRERA ||--|| USUARIO : "operada por"
    USUARIO ||--o{ HISTORIAL_ACCESOS : "registra acceso"
 
    DOCUMENTO {
        int id_documento PK
        varchar tipo "DNI, Pasaporte, Carnet de Extranjería"
    }
    PERSONA {
        int id_persona PK
        int id_documento FK
        varchar primer_nombre
        varchar segundo_nombre
        varchar primer_apellido
        varchar segundo_apellido
        varchar numero_documento
    }
    VEHICULO {
        int id_vehiculo PK
        int id_persona FK
        varchar placa_vehiculo
    }
    USUARIO {
        int id_usuario PK
        int id_persona FK
        varchar email "Unique"
        varchar contrasena
        varchar rol "USER | ADMIN"
        varchar codigo_rfid "Unique"
        int token_version
    }
    LUGAR {
        int id_lugar PK
        int numero "Número de cochera"
        boolean disponible "Estado del sensor físico"
    }
    RESERVA {
        int id_reserva PK
        int id_usuario FK
        int id_lugar FK
        int id_vehiculo FK
        date fecha
        time hora
        varchar estado "Espera | Atendido | Cancelado | Perdida"
        timestamptz update_at
    }
    REGISTRO_VEHICULAR {
        int id_registro PK
        int id_lugar FK
        varchar tipo "INGRESO | SALIDA"
        timestamptz fecha_hora
    }
    BARRERA {
        int id_barrera PK
        varchar estado "ABIERTA | CERRADA"
        timestamptz updated_at
    }
    HISTORIAL_ACCESOS {
        int id_acceso PK
        int id_usuario FK
        varchar tipo "INGRESO | SALIDA"
        varchar codigo_rfid
        timestamptz fecha_hora
    }r FK
        varchar tipo "INGRESO | SALIDA"
        timestamptz fecha_hora
    }
    BARRERA {
        int id_barrera PK
        varchar estado "ABIERTA | CERRADA"
        timestamptz updated_at
    }
```

---

## 📁 Estructura del Repositorio

```text
EstacionamientoInteligente/
│
├── backend/                       # API Rest en Node.js + Express
│   ├── config/                    # Configuración de base de datos
│   │   └── db.js                  # Pool de conexiones de PostgreSQL
│   ├── controllers/               # Lógica de negocio
│   │   ├── authController.js      # Registro, Login e info de perfil
│   │   ├── reservationsController.js # CRUD y validaciones de reservas
│   │   └── spacesController.js    # Control de cajones y reportes
│   ├── middlewares/               # Validaciones intermedias
│   │   └── authMiddleware.js      # Validación de tokens JWT e inactividad
│   ├── routes/                    # Enrutadores de Express
│   │   ├── authRoutes.js
│   │   ├── reservationsRoutes.js
│   │   └── spacesRoutes.js
│   ├── index.js                   # Archivo de inicio del servidor API
│   └── package.json               # Dependencias del backend
│
├── frontend/                      # Cliente web SPA en React
│   ├── src/                       # Código fuente de React
│   │   ├── components/            # Componentes reutilizables
│   │   │   ├── 3d/
│   │   │   │   └── ParkingLot.jsx # Mapa interactivo 3D con Three.js
│   │   │   └── Navbar.jsx         # Menú de navegación adaptable
│   │   ├── pages/                 # Páginas completas
│   │   │   ├── AdminDashboard.jsx # Panel administrativo
│   │   │   └── Dashboard.jsx      # Panel de usuario regular
│   │   ├── services/api.js        # Instancia de Axios con interceptor JWT
│   │   ├── store/authStore.js     # Store de Zustand para auth y tokens
│   │   └── index.css              # Estilos globales y variables de Tailwind v4
│   └── package.json               # Dependencias del frontend
│
└── arduino/                       # Código de microcontroladores
    ├── Codigo_ESP32_Entrada/
    │   └── Codigo_ESP32_Entrada.ino # Firmware ESP32 Principal (38 pines)
    └── Codigo_ESP32_Salida/
        └── Codigo_ESP32_Salida.ino  # Firmware ESP32 Secundario (30 pines)
```

---

## 🛠️ Instrucciones de Instalación y Despliegue

### Paso 1: Configurar PostgreSQL
1. Crea una base de datos PostgreSQL llamada `estacionamiento_inteligente`.
2. Ejecuta el esquema para las tablas (`Lugar`, `Reserva`, `Usuario`, etc.).
3. Popula la tabla `Lugar` con los cajones del 1 al 10:
   ```sql
   INSERT INTO Lugar (numero, disponible) VALUES 
   (1, true), (2, true), (3, true), (4, true), (5, true),
   (6, true), (7, true), (8, true), (9, true), (10, true);
   ```

### Paso 2: Ejecutar Backend
1. Navega a `backend/` e instala las dependencias:
   ```bash
   npm install
   ```
2. Configura las credenciales en un archivo `.env` en la raíz de `backend/`.
3. Inicia el servidor de Node.js:
   ```bash
   npm start
   ```

### Paso 3: Ejecutar Frontend
1. Navega a `frontend/` e instala las dependencias:
   ```bash
   npm install
   ```
2. Inicia la aplicación React con Vite:
   ```bash
   npm run dev
   ```
   *Disponible por defecto en [http://localhost:5173](http://localhost:5173).*

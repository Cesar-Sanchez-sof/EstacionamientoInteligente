#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_NeoPixel.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// --- CONFIGURACIÓN DE RED WIFI ---
const char* ssid = "XIDI";
const char* password = "18011303";

// --- CONFIGURACIÓN DE PINES (según asignacion_pines_esp32.md) ---
#define I2C_SDA 21
#define I2C_SCL 22
#define SS_PIN 5
#define RST_PIN 4
#define PIN_SERVO_ENT 13
#define PIN_SERVO_SAL 14
#define PIN_NEOPIXEL 15
#define PIN_FC51_ENT 16
#define PIN_FC51_SAL 17

// Cantidad de cajones y LEDs
#define NUM_CAJONES 10
#define NUM_LEDS 20  // 2 LEDs por cajón

// --- CONFIGURACIÓN DE ÁNGULOS PARA SERVOMOTORES ---
const int ENTRADA_CERRADO = 90;
const int ENTRADA_ABIERTO = 0;
const int SALIDA_CERRADO  = 0;
const int SALIDA_ABIERTO  = 90;

// Pines para los 10 sensores FC-51 de cajones
const int pinFC51Cajones[NUM_CAJONES] = { 25, 26, 27, 32, 33, 34, 35, 36, 39, 12 };

// --- INICIALIZACIÓN DE PERIFÉRICOS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 rfid(SS_PIN, RST_PIN);
Servo servoEntrada;
Servo servoSalida;
Adafruit_NeoPixel pixels(NUM_LEDS, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

// --- ESTADOS FÍSICOS DE LAS BARRERAS ---
bool entradaAbierta = false;
bool salidaAbierta = false;
bool bloqueoEntrada = false;
bool bloqueoSalida = false;

// --- VARIABLES COMPARTIDAS ENTRE NÚCLEOS (THREAD-SAFE / VOLATILE) ---
volatile bool cmdAbrirEntrada = false;
volatile bool cmdAbrirSalida = false;
volatile int espaciosLibres = 0;
volatile int espaciosTotales = 0;
volatile bool datosRecibidos = false;

// Estado físico de ocupación de cajones (true = libre, false = ocupado)
bool estadoFisico[NUM_CAJONES] = { true, true, true, true, true, true, true, true, true, true };
bool ultimoEstadoFisico[NUM_CAJONES] = { true, true, true, true, true, true, true, true, true, true };
unsigned long tiempoCambio[NUM_CAJONES] = { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 };
const unsigned long tiempoDebounce = 2000;  // 2 segundos de rebote

// Señales y estado desde/hacia la nube
volatile bool disponibleServidor[NUM_CAJONES] = { true, true, true, true, true, true, true, true, true, true };
volatile bool reservadoServidor[NUM_CAJONES] = { false, false, false, false, false, false, false, false, false, false };
volatile bool necesitaEnviar[NUM_CAJONES] = { false, false, false, false, false, false, false, false, false, false };
volatile bool enviarDisponible[NUM_CAJONES] = { true, true, true, true, true, true, true, true, true, true };

// Cerrojos (latches) para evitar doble apertura desde web
bool remotoEntradaProcesado = false;
bool remotoSalidaProcesado = false;

// --- TIMERS PARA EL PROCESAMIENTO ---
unsigned long lastApiTime = 0;
const unsigned long apiDelay = 5000;
unsigned long lastBarrierApiTime = 0;
const unsigned long barrierApiDelay = 1500;
unsigned long lastStatusApiTime = 0;
const unsigned long statusApiDelay = 1500;  // Consultar reservas y disponibilidad cada 1.5s

unsigned long tiempoAperturaEntrada = 0;
unsigned long tiempoAperturaSalida = 0;
const unsigned long duracionApertura = 5000;  // 5 segundos de barrera abierta

// Declaración de funciones
void verificarCuposServidor();
void verificarBarrerasServidor();
void consultarReservasServidor();
void enviarEstadoCajon(int id_lugar, bool disponible);
void restaurarPantallaLCD();
void tareaNetwork(void* pvParameters);

void setup() {
  // Desactivar Brownout Detector
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
  
  Serial.begin(115200);

  // 1. Inicializar I2C y LCD
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Iniciando...");

  // 2. Inicializar NeoPixels
  pixels.begin();
  pixels.setBrightness(100);
  for (int i = 0; i < NUM_LEDS; i++) {
    pixels.setPixelColor(i, pixels.Color(0, 0, 0));
  }
  pixels.show();

  // 3. Inicializar Sensores y RFID
  SPI.begin();
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
  pinMode(PIN_FC51_ENT, INPUT);
  pinMode(PIN_FC51_SAL, INPUT);
  for (int i = 0; i < NUM_CAJONES; i++) {
    pinMode(pinFC51Cajones[i], INPUT);
  }

  delay(500);  // Estabilización eléctrica

  // Leer estado inicial físico de los sensores de los cajones y programar sincronización inicial
  Serial.println("Estableciendo estado inicial de cajones...");
  for (int i = 0; i < NUM_CAJONES; i++) {
    bool lecturaInicial = (digitalRead(pinFC51Cajones[i]) == HIGH); // HIGH = libre
    estadoFisico[i] = lecturaInicial;
    ultimoEstadoFisico[i] = lecturaInicial;
    disponibleServidor[i] = lecturaInicial;
    
    // Forzar actualización inicial en la base de datos
    enviarDisponible[i] = lecturaInicial;
    necesitaEnviar[i] = true;
    
    Serial.print("Cajon ");
    Serial.print(i + 1);
    Serial.print(" inicializado como: ");
    Serial.println(lecturaInicial ? "LIBRE" : "OCUPADO");
  }

  // 4. Inicializar Servomotores (cerrados por defecto)
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);

  servoEntrada.setPeriodHertz(50);
  servoEntrada.attach(PIN_SERVO_ENT, 500, 2400);
  servoEntrada.write(ENTRADA_CERRADO);

  servoSalida.setPeriodHertz(50);
  servoSalida.attach(PIN_SERVO_SAL, 500, 2400);
  servoSalida.write(SALIDA_CERRADO);

  // 5. Conectar a WiFi
  WiFi.begin(ssid, password);
  lcd.setCursor(0, 1);
  lcd.print("Conectando WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Conectado!");
  delay(1000);

  restaurarPantallaLCD();

  // 6. CREAR TAREA ASÍNCRONA EN CORE 0 PARA LLAMADAS DE RED (Evita congelar sensores/servos)
  xTaskCreatePinnedToCore(
    tareaNetwork,
    "TareaNetwork",
    8192,
    NULL,
    1,
    NULL,
    0);
}

// =========================================================================
// NÚCLEO 1: LOOP FÍSICO DE ALTA VELOCIDAD (RFID, SERVOS, LEDS Y SENSORES)
// =========================================================================
// --- TEMPORIZACIÓN DE RFID ---
unsigned long lastRfidCheckTime = 0;
const unsigned long rfidCheckDelay = 150; // Consultar cada 150ms

unsigned long lastRfidInitTime = 0;
const unsigned long rfidInitInterval = 4000; // Re-inicializar el RFID cada 4 segundos para evitar congelamientos

void loop() {
  // 1. Lectura instantánea de sensores de acceso (HIGH = libre, LOW = objeto detectado)
  bool objetoEnEntrada = (digitalRead(PIN_FC51_ENT) == LOW);
  bool objetoEnSalida = (digitalRead(PIN_FC51_SAL) == LOW);
  bool rfidDetectado = false;

  // 2. Lectura del lector RFID con temporizador no bloqueante
  if (millis() - lastRfidCheckTime >= rfidCheckDelay) {
    lastRfidCheckTime = millis();
    
    // Heartbeat: Re-inicializa periódicamente el chip RC522 si ha estado inactivo para evitar bloqueos del bus SPI
    if (millis() - lastRfidInitTime >= rfidInitInterval) {
      lastRfidInitTime = millis();
      rfid.PCD_Init();
      rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
      Serial.println("RFID: Heartbeat re-init (evita congelamientos e incrementa ganancia).");
    }
    
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      rfidDetectado = true;
      lastRfidInitTime = millis(); // Reinicia el timer para evitar interferir con la lectura actual
      
      // Imprimir UID de la tarjeta en el Monitor Serie
      Serial.print("RFID: Tarjeta leida - UID: ");
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) {
          Serial.print("0");
        }
        Serial.print(rfid.uid.uidByte[i], HEX);
        if (i < rfid.uid.size - 1) {
          Serial.print(" ");
        }
      }
      Serial.println();

      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
    }
  }

  // 3. Apertura de Entrada (El RFID ignora el bloqueoEntrada; el sensor de paso lo respeta)
  if ((rfidDetectado || (objetoEnEntrada && !bloqueoEntrada)) && !entradaAbierta) {
    servoEntrada.write(ENTRADA_ABIERTO);
    entradaAbierta = true;
    tiempoAperturaEntrada = millis();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("BARRERA ENTRADA");
    lcd.setCursor(0, 1);
    lcd.print(rfidDetectado ? "Acceso Concedido" : "Pase por favor..");
    Serial.println(">>> Barrera de ENTRADA abierta localmente.");
  }

  // 4. Apertura de Salida (Solo por sensor FC-51 de salida)
  if (objetoEnSalida && !salidaAbierta && !bloqueoSalida) {
    servoSalida.write(SALIDA_ABIERTO);
    salidaAbierta = true;
    tiempoAperturaSalida = millis();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("BARRERA SALIDA");
    lcd.setCursor(0, 1);
    lcd.print("Hasta pronto!   ");
    Serial.println(">>> Barrera de SALIDA abierta localmente.");
  }

  // 5. Comandos de Apertura Remota desde la Web
  if (cmdAbrirEntrada) {
    cmdAbrirEntrada = false;
    if (!entradaAbierta) {
      servoEntrada.write(ENTRADA_ABIERTO);
      entradaAbierta = true;
      tiempoAperturaEntrada = millis();

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("BARRERA ENTRADA");
      lcd.setCursor(0, 1);
      lcd.print("Apertura Remota");
    }
  }

  if (cmdAbrirSalida) {
    cmdAbrirSalida = false;
    if (!salidaAbierta) {
      servoSalida.write(SALIDA_ABIERTO);
      salidaAbierta = true;
      tiempoAperturaSalida = millis();

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("BARRERA SALIDA");
      lcd.setCursor(0, 1);
      lcd.print("Apertura Remota");
    }
  }

  // 6. Lógica de Cierre Automático tras 5 segundos
  if (entradaAbierta && (millis() - tiempoAperturaEntrada >= duracionApertura)) {
    servoEntrada.write(ENTRADA_CERRADO);
    entradaAbierta = false;
    bloqueoEntrada = true;
    restaurarPantallaLCD();
    rfid.PCD_Init(); // Re-inicializar lector RFID por si hubo caídas de tensión por el servo
    Serial.println("RFID re-inicializado tras cierre de Entrada.");
  }
  if (!objetoEnEntrada) {
    bloqueoEntrada = false;
  }

  if (salidaAbierta && (millis() - tiempoAperturaSalida >= duracionApertura)) {
    servoSalida.write(SALIDA_CERRADO);
    salidaAbierta = false;
    bloqueoSalida = true;
    restaurarPantallaLCD();
    rfid.PCD_Init(); // Re-inicializar lector RFID por si hubo caídas de tensión por el servo
    Serial.println("RFID re-inicializado tras cierre de Salida.");
  }
  if (!objetoEnSalida) {
    bloqueoSalida = false;
  }

  // 7. Monitoreo y Debouncing de los 10 sensores de cajones
  for (int i = 0; i < NUM_CAJONES; i++) {
    bool lecturaInstantanea = (digitalRead(pinFC51Cajones[i]) == HIGH);  // HIGH = libre, LOW = ocupado

    if (lecturaInstantanea != ultimoEstadoFisico[i]) {
      ultimoEstadoFisico[i] = lecturaInstantanea;
      tiempoCambio[i] = millis();
    }

    if ((millis() - tiempoCambio[i]) > tiempoDebounce) {
      if (lecturaInstantanea != estadoFisico[i]) {
        estadoFisico[i] = lecturaInstantanea;

        enviarDisponible[i] = estadoFisico[i];
        necesitaEnviar[i] = true;  // Indicar a red enviar actualización

        // Calcular cupos libres localmente para actualizar el LCD de inmediato
        int libresLocales = 0;
        for (int j = 0; j < NUM_CAJONES; j++) {
          if (estadoFisico[j] && !reservadoServidor[j]) {
            libresLocales++;
          }
        }
        espaciosLibres = libresLocales;
        restaurarPantallaLCD();

        Serial.print("Cajon ");
        Serial.print(i + 1);
        Serial.print(" cambio a: ");
        Serial.println(estadoFisico[i] ? "LIBRE" : "OCUPADO");
      }
    }
  }

  // 8. Actualizar colores de la tira NeoPixel (2 LEDs por cajón)
  for (int i = 0; i < NUM_CAJONES; i++) {
    int ledIdx1 = 2 * i;
    int ledIdx2 = 2 * i + 1;

    if (!estadoFisico[i]) {
      // 1. Si está físicamente ocupado (sensor local) -> ROJO
      pixels.setPixelColor(ledIdx1, pixels.Color(255, 0, 0));
      pixels.setPixelColor(ledIdx2, pixels.Color(255, 0, 0));
    } else if (reservadoServidor[i]) {
      // 2. Si está físicamente libre pero reservado en el servidor -> AZUL
      pixels.setPixelColor(ledIdx1, pixels.Color(0, 0, 255));
      pixels.setPixelColor(ledIdx2, pixels.Color(0, 0, 255));
    } else if (!disponibleServidor[i]) {
      // 3. Si está físicamente libre pero el sistema web lo marcó como ocupado -> ROJO
      pixels.setPixelColor(ledIdx1, pixels.Color(255, 0, 0));
      pixels.setPixelColor(ledIdx2, pixels.Color(255, 0, 0));
    } else {
      // 4. Libre físicamente sin reservas -> VERDE
      pixels.setPixelColor(ledIdx1, pixels.Color(0, 255, 0));
      pixels.setPixelColor(ledIdx2, pixels.Color(0, 255, 0));
    }
  }
  pixels.show();

  // 9. Actualización periódica pasiva de la pantalla LCD
  static int ultimoEstadoCupos = -1;
  if (datosRecibidos && ultimoEstadoCupos != espaciosLibres && !entradaAbierta && !salidaAbierta) {
    ultimoEstadoCupos = espaciosLibres;
    restaurarPantallaLCD();
  }

  delay(20);
}

// =========================================================================
// NÚCLEO 0: TAREA RED / HTTP (PROCESAMIENTO ASÍNCRONO SIN AFECTAR HARDWARE)
// =========================================================================
void tareaNetwork(void* pvParameters) {
  for (;;) {
    // 1. Procesar actualizaciones de cajones al servidor (PUT)
    for (int i = 0; i < NUM_CAJONES; i++) {
      if (necesitaEnviar[i]) {
        bool disponible = enviarDisponible[i];
        int id_lugar = i + 1;
        enviarEstadoCajon(id_lugar, disponible);
        necesitaEnviar[i] = false;
      }
    }

    // 2. Polling de barreras web (cada 1.5 segundos)
    if ((millis() - lastBarrierApiTime) > barrierApiDelay || lastBarrierApiTime == 0) {
      verificarBarrerasServidor();
      lastBarrierApiTime = millis();
    }

    // 3. Polling de cupos totales (cada 5 segundos)
    if ((millis() - lastApiTime) > apiDelay || lastApiTime == 0) {
      verificarCuposServidor();
      lastApiTime = millis();
    }

    // 4. Polling de reservas de cajones (cada 3 segundos)
    if ((millis() - lastStatusApiTime) > statusApiDelay || lastStatusApiTime == 0) {
      consultarReservasServidor();
      lastStatusApiTime = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void enviarEstadoCajon(int id_lugar, bool disponible) {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;

    String url = "https://estacionamiento-inteligente.vercel.app/api/spaces/public/" + String(id_lugar);
    
    Serial.print("RFID/Sensor: Enviando Cajon ");
    Serial.print(id_lugar);
    Serial.print(" (disponible: ");
    Serial.print(disponible ? "true" : "false");
    Serial.print(") a URL: ");
    Serial.println(url);

    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("User-Agent", "ESP32");

    String body = "{\"disponible\":" + String(disponible ? "true" : "false") + "}";
    int httpResponseCode = http.PUT(body);
    
    Serial.print("-> Respuesta HTTP: ");
    Serial.println(httpResponseCode);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("-> Servidor responde: " + response);
    } else {
      Serial.print("-> Error de red: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }
    
    http.end();
  } else {
    Serial.println("No se puede enviar estado: WiFi desconectado.");
  }
}

void verificarCuposServidor() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.begin(client, "https://estacionamiento-inteligente.vercel.app/api/spaces/public/count");
    http.addHeader("User-Agent", "ESP32");

    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
      String payload = http.getString();
#if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
#else
      DynamicJsonDocument doc(1024);
#endif
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        espaciosTotales = doc["total"];
        espaciosLibres = doc["free"];
        datosRecibidos = true;
      }
    }
    http.end();
  }
}

void verificarBarrerasServidor() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.begin(client, "https://estacionamiento-inteligente.vercel.app/api/spaces/barrier/status");
    http.addHeader("User-Agent", "ESP32");

    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
      String payload = http.getString();
#if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
#else
      DynamicJsonDocument doc(1024);
#endif
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        JsonArray arr = doc.as<JsonArray>();
        for (JsonVariant val : arr) {
          int id_barrera = val["id_barrera"];
          String estado = val["estado"];

          if (id_barrera == 1) {  // Entrada
            if (estado == "ABIERTA") {
              if (!remotoEntradaProcesado) {
                cmdAbrirEntrada = true;
                remotoEntradaProcesado = true;
              }
            } else if (estado == "CERRADA") {
              remotoEntradaProcesado = false;
            }
          } else if (id_barrera == 2) {  // Salida
            if (estado == "ABIERTA") {
              if (!remotoSalidaProcesado) {
                cmdAbrirSalida = true;
                remotoSalidaProcesado = true;
              }
            } else if (estado == "CERRADA") {
              remotoSalidaProcesado = false;
            }
          }
        }
      }
    }
    http.end();
  }
}

void consultarReservasServidor() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.begin(client, "https://estacionamiento-inteligente.vercel.app/api/spaces/public/status");
    http.addHeader("User-Agent", "ESP32");

    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
      String payload = http.getString();
#if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
#else
      DynamicJsonDocument doc(2048);
#endif
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        JsonArray arr = doc.as<JsonArray>();
        for (JsonVariant val : arr) {
          int numero = val["numero"];
          bool disponible = val["disponible"];
          bool reservado = val["reservado"];

          if (numero >= 1 && numero <= NUM_CAJONES) {
            disponibleServidor[numero - 1] = disponible;
            reservadoServidor[numero - 1] = reservado;
          }
        }
        // Recalcular cupos libres localmente (el loop en Core 1 se encargará del redibujo de forma segura)
        int libresLocales = 0;
        for (int j = 0; j < NUM_CAJONES; j++) {
          if (estadoFisico[j] && !reservadoServidor[j]) {
            libresLocales++;
          }
        }
        espaciosLibres = libresLocales;
      }
    }
    http.end();
  }
}

void restaurarPantallaLCD() {
  if (!entradaAbierta && !salidaAbierta) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SISTEMA PARKING");
    lcd.setCursor(0, 1);

    if (datosRecibidos) {
      lcd.print("Libres: ");
      lcd.print(espaciosLibres);
      lcd.print(" / ");
      lcd.print(espaciosTotales);
    } else {
      lcd.print("Actualizando...");
    }
  }
}

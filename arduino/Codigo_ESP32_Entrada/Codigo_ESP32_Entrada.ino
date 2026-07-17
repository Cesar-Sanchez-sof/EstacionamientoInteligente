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

// --- CONFIGURACIÓN DE BACKEND ---
// Autodetecta http o https. Puedes usar "http://192.168.x.x:5000" en local o tu URL de Vercel
const String backendUrl = "https://estacionamiento-inteligente.vercel.app";

// --- CONFIGURACIÓN DE DIRECCIÓN I2C DE LA PANTALLA LCD ---
#define LCD_ADDRESS      0x27  // Por defecto 0x27. Cambiar a 0x3F si tu LCD I2C no muestra texto

// --- CONFIGURACIÓN DE PINES (ESP32 de 38 Pines) ---
#define I2C_SDA          21
#define I2C_SCL          22
#define SS_PIN           5
#define RST_PIN          4
#define PIN_SERVO_ENT    13
#define PIN_NEOPIXEL     15
#define PIN_FC51_ENT     16

// Cantidad de cajones y LEDs
#define NUM_CAJONES      10
#define NUM_LEDS         20 // 2 LEDs por cajón

// Pines para los 10 sensores FC-51 de cajones
// CAMBIO IMPORTANTE: Se cambió el pin del cajón 10 de 12 a 14 para evitar conflicto de booteo (strapping pin)
const int pinFC51Cajones[NUM_CAJONES] = {25, 26, 27, 32, 33, 34, 35, 36, 39, 14};

// --- ÁNGULOS DE LOS SERVOMOTORES (AJUSTABLES) ---
const int ENTRADA_CERRADO = 90;
const int ENTRADA_ABIERTO = 0;

// --- INICIALIZACIÓN DE PERIFÉRICOS ---
LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2); 
MFRC522 rfid(SS_PIN, RST_PIN);
Servo servoEntrada;
Adafruit_NeoPixel pixels(NUM_LEDS, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

// --- ESTADOS FÍSICOS DE LAS BARRERAS ---
bool entradaAbierta = false; 
bool bloqueoEntrada = false; 

// --- VARIABLES COMPARTIDAS ENTRE NÚCLEOS ---
volatile bool cmdAbrirEntrada = false;
volatile int espaciosLibres = 0;
volatile int espaciosTotales = 0;
volatile bool datosRecibidos = false; 
volatile int ultimoErrorHttp = 0; 

// Estado físico de ocupación de cajones (true = libre, false = ocupado)
bool estadoFisico[NUM_CAJONES] = {true, true, true, true, true, true, true, true, true, true};
bool ultimoEstadoFisico[NUM_CAJONES] = {true, true, true, true, true, true, true, true, true, true};
unsigned long tiempoCambio[NUM_CAJONES] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
const unsigned long tiempoDebounce = 2000; // 2 segundos de rebote

// Señales y estado desde/hacia la nube
volatile bool disponibleServidor[NUM_CAJONES] = {true, true, true, true, true, true, true, true, true, true};
volatile bool reservadoServidor[NUM_CAJONES] = {false, false, false, false, false, false, false, false, false, false};
volatile bool necesitaEnviar[NUM_CAJONES] = {false, false, false, false, false, false, false, false, false, false};
volatile bool enviarDisponible[NUM_CAJONES] = {true, true, true, true, true, true, true, true, true, true};

// Cerrojos (latches) para evitar doble apertura desde web
bool remotoEntradaProcesado = false; 

// Cola para solicitudes de validación de RFID de entrada
volatile bool rfidPendingRequest = false;
char rfidPendingUid[30] = "";

// --- TIMERS PARA EL PROCESAMIENTO ---
unsigned long lastApiTime = 0;
const unsigned long apiDelay = 5000; 
unsigned long lastBarrierApiTime = 0;
const unsigned long barrierApiDelay = 1500; 
unsigned long lastStatusApiTime = 0;
const unsigned long statusApiDelay = 1500; // Consultar reservas cada 1.5s

unsigned long tiempoAperturaEntrada = 0;
const unsigned long duracionApertura = 5000; // 5 segundos de barrera abierta

unsigned long lastRfidInitTime = 0;
const unsigned long rfidInitInterval = 4000; // Re-inicializar el RFID cada 4 segundos para evitar congelamientos

// Declaración de funciones
int makeHttpRequest(String url, String method, String payload, String &responseOut);
void verificarCuposServidor();
void verificarBarrerasServidor();
void consultarReservasServidor();
void enviarEstadoCajon(int id_lugar, bool disponible);
void enviarRfidAccesoEntrada(const char* uid);
void restaurarPantallaLCD();
void tareaNetwork(void * pvParameters);

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Desactivar detector de brownout para estabilidad eléctrica
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
  for (int i = 0; i < NUM_CAJONES; i++) {
    pinMode(pinFC51Cajones[i], INPUT);
  }
  
  delay(500); // Estabilización eléctrica

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

  // 4. Inicializar Servomotor de Entrada
  ESP32PWM::allocateTimer(0);
  servoEntrada.setPeriodHertz(50); 
  servoEntrada.attach(PIN_SERVO_ENT, 500, 2400); 
  servoEntrada.write(ENTRADA_CERRADO);

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
    0
  );
}

// =========================================================================
// NÚCLEO 1: LOOP FÍSICO DE ALTA VELOCIDAD (RFID, SERVO, LEDS Y SENSORES)
// =========================================================================
void loop() {
  // 1. Lectura instantánea del sensor de acceso de entrada (HIGH = libre, LOW = objeto detectado)
  bool objetoEnEntrada = (digitalRead(PIN_FC51_ENT) == LOW);

  // 2. Lectura del lector RFID de Entrada
  if (millis() - lastRfidInitTime >= rfidInitInterval) {
    lastRfidInitTime = millis();
    rfid.PCD_Init();
    rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
  }

  if (!rfidPendingRequest && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    lastRfidInitTime = millis(); // Reiniciar timer de heartbeat para no interrumpir lectura
    
    // Formatear el UID en una cadena hexadecimal (ej: "A0 B1 C2 D3")
    String uidString = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) {
        uidString += "0";
      }
      uidString += String(rfid.uid.uidByte[i], HEX);
      if (i < rfid.uid.size - 1) {
        uidString += " ";
      }
    }
    uidString.toUpperCase();
    
    Serial.print("RFID Entrada: Tarjeta leida - UID: ");
    Serial.println(uidString);
    
    // Copiar UID a la variable compartida para que Core 0 haga la consulta web (como en tu código original)
    uidString.toCharArray((char*)rfidPendingUid, sizeof(rfidPendingUid));
    rfidPendingRequest = true;
    cmdAbrirEntrada = true; // Abrir de inmediato localmente al pasar la tarjeta para evitar demoras físicas

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // 3. Comando de Apertura local o Remota (Web / RFID Aprobado)
  if (cmdAbrirEntrada) {
    cmdAbrirEntrada = false;
    if (!entradaAbierta) {
      delay(250); // Pausa para estabilizar la corriente de la fuente antes de mover el servo
      servoEntrada.write(ENTRADA_ABIERTO); 
      entradaAbierta = true;
      tiempoAperturaEntrada = millis();
    }
  }

  // 4. Lógica de Cierre Automático tras 5 segundos
  if (entradaAbierta && (millis() - tiempoAperturaEntrada >= duracionApertura)) {
    servoEntrada.write(ENTRADA_CERRADO); 
    entradaAbierta = false;
    bloqueoEntrada = true;
    restaurarPantallaLCD();
    rfid.PCD_Init(); // Re-inicializar lector RFID por si hubo caídas de tensión por el servo
    rfid.PCD_SetAntennaGain(MFRC522::RxGain_max); // Restablecer ganancia máxima de antena
    Serial.println("RFID re-inicializado tras cierre de Entrada.");
  }
  if (!objetoEnEntrada) {
    bloqueoEntrada = false;
  }

  // 5. Monitoreo y Debouncing de los 10 sensores de cajones
  for (int i = 0; i < NUM_CAJONES; i++) {
    bool lecturaInstantanea = (digitalRead(pinFC51Cajones[i]) == HIGH); // HIGH = libre, LOW = ocupado
    
    if (lecturaInstantanea != ultimoEstadoFisico[i]) {
      ultimoEstadoFisico[i] = lecturaInstantanea;
      tiempoCambio[i] = millis();
    }
    
    if ((millis() - tiempoCambio[i]) > tiempoDebounce) {
      if (lecturaInstantanea != estadoFisico[i]) {
        estadoFisico[i] = lecturaInstantanea;
        
        enviarDisponible[i] = estadoFisico[i];
        necesitaEnviar[i] = true; // Indicar a red enviar actualización
        
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

  // 6. Actualizar colores de la tira NeoPixel (2 LEDs por cajón)
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

  // 7. Actualización periódica pasiva de la pantalla LCD
  static int ultimoEstadoCupos = -1;
  if (datosRecibidos && ultimoEstadoCupos != espaciosLibres && !entradaAbierta) {
    ultimoEstadoCupos = espaciosLibres;
    restaurarPantallaLCD();
  }

  delay(20);
}

// =========================================================================
// NÚCLEO 0: TAREA RED / HTTP (PROCESAMIENTO SERIALIZADO Y SEGURO)
// =========================================================================
void tareaNetwork(void * pvParameters) {
  for(;;) {
    if (WiFi.status() == WL_CONNECTED) {
      
      // 1. Prioridad: Procesar solicitudes de acceso RFID de entrada
      if (rfidPendingRequest) {
        enviarRfidAccesoEntrada((const char*)rfidPendingUid);
        rfidPendingRequest = false;
        vTaskDelay(pdMS_TO_TICKS(100)); // Pequeña pausa para no solapar sockets
      }

      // 2. Prioridad: Procesar actualizaciones de cajones al servidor (PUT)
      for (int i = 0; i < NUM_CAJONES; i++) {
        if (necesitaEnviar[i]) {
          enviarEstadoCajon(i + 1, enviarDisponible[i]);
          necesitaEnviar[i] = false;
          vTaskDelay(pdMS_TO_TICKS(100));
        }
      }

      // 3. Polling de barreras web (cada 1.5 segundos)
      if ((millis() - lastBarrierApiTime) > barrierApiDelay || lastBarrierApiTime == 0) {
        verificarBarrerasServidor();
        lastBarrierApiTime = millis();
        vTaskDelay(pdMS_TO_TICKS(100));
      }
      
      // 4. Polling de cupos totales (cada 5 segundos)
      if ((millis() - lastApiTime) > apiDelay || lastApiTime == 0) {
        verificarCuposServidor();
        lastApiTime = millis();
        vTaskDelay(pdMS_TO_TICKS(100));
      }

      // 5. Polling de reservas de cajones (cada 1.5 segundos)
      if ((millis() - lastStatusApiTime) > statusApiDelay || lastStatusApiTime == 0) {
        consultarReservasServidor();
        lastStatusApiTime = millis();
        vTaskDelay(pdMS_TO_TICKS(100));
      }
    }
    
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// Función auxiliar agnóstica para realizar peticiones HTTP o HTTPS dinámicamente sin leaks de memoria
int makeHttpRequest(String url, String method, String payload, String &responseOut) {
  int httpResponseCode = -1;
  bool isHttps = url.startsWith("https://");
  
  if (isHttps) {
    WiFiClientSecure client;
    client.setInsecure(); // Omitir verificación de cadena de certificados
    HTTPClient http;
    if (http.begin(client, url)) {
      http.addHeader("User-Agent", "ESP32-Entrada");
      if (method == "POST" || method == "PUT") {
        http.addHeader("Content-Type", "application/json");
        httpResponseCode = (method == "POST") ? http.POST(payload) : http.PUT(payload);
      } else {
        httpResponseCode = http.GET();
      }
      
      if (httpResponseCode > 0) {
        responseOut = http.getString();
      } else {
        Serial.print("HTTP Error en ");
        Serial.print(url);
        Serial.print(": ");
        Serial.println(http.errorToString(httpResponseCode).c_str());
      }
      http.end();
    }
  } else {
    WiFiClient client;
    HTTPClient http;
    if (http.begin(client, url)) {
      http.addHeader("User-Agent", "ESP32-Entrada");
      if (method == "POST" || method == "PUT") {
        http.addHeader("Content-Type", "application/json");
        httpResponseCode = (method == "POST") ? http.POST(payload) : http.PUT(payload);
      } else {
        httpResponseCode = http.GET();
      }
      
      if (httpResponseCode > 0) {
        responseOut = http.getString();
      } else {
        Serial.print("HTTP Error en ");
        Serial.print(url);
        Serial.print(": ");
        Serial.println(http.errorToString(httpResponseCode).c_str());
      }
      http.end();
    }
  }
  
  return httpResponseCode;
}

void enviarEstadoCajon(int id_lugar, bool disponible) {
  String url = backendUrl + "/api/spaces/public/" + String(id_lugar);
  String body = "{\"disponible\":" + String(disponible ? "true" : "false") + "}";
  String response;
  makeHttpRequest(url, "PUT", body, response);
}

void enviarRfidAccesoEntrada(const char* uid) {
  String url = backendUrl + "/api/spaces/access/entry";
  String body = "{\"codigo_rfid\":\"" + String(uid) + "\"}";
  String response;
  
  int httpResponseCode = makeHttpRequest(url, "POST", body, response);
  if (httpResponseCode == 200) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(1024);
#endif
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      bool success = doc["success"];
      String usuario = doc["usuario"];
      
      if (success) {
        cmdAbrirEntrada = true;
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("ACCESO CONCEDIDO");
        lcd.setCursor(0, 1);
        lcd.print(usuario.substring(0, 16)); 
        Serial.print(">>> Acceso RFID concedido a: ");
        Serial.println(usuario);
        vTaskDelay(pdMS_TO_TICKS(1500)); // Usar vTaskDelay seguro en Core 0
      }
    }
  } else {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("LECTURA RFID OK ");
    lcd.setCursor(0, 1);
    lcd.print("No Registrada   ");
    Serial.println(">>> Acceso RFID leido pero no registrado.");
    vTaskDelay(pdMS_TO_TICKS(1500));
    restaurarPantallaLCD();
  }
}

void verificarCuposServidor() {
  String url = backendUrl + "/api/spaces/public/count";
  String response;
  
  int httpResponseCode = makeHttpRequest(url, "GET", "", response);
  if (httpResponseCode == 200) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(1024);
#endif
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      espaciosTotales = doc["total"];
      espaciosLibres = doc["free"];
      datosRecibidos = true;
      ultimoErrorHttp = 0; 
    } else {
      ultimoErrorHttp = -999; 
    }
  } else {
    ultimoErrorHttp = httpResponseCode;
  }
}

void verificarBarrerasServidor() {
  String url = backendUrl + "/api/spaces/barrier/status";
  String response;
  
  int httpResponseCode = makeHttpRequest(url, "GET", "", response);
  if (httpResponseCode == 200) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(1024);
#endif
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      JsonArray arr = doc.as<JsonArray>();
      for (JsonVariant val : arr) {
        int id_barrera = val["id_barrera"];
        String estado = val["estado"];
        
        if (id_barrera == 1) { // Entrada
          if (estado == "ABIERTA") {
            if (!remotoEntradaProcesado) {
              cmdAbrirEntrada = true;
              remotoEntradaProcesado = true;
            }
          } else if (estado == "CERRADA") {
            remotoEntradaProcesado = false;
          }
        }
      }
    }
  }
}

void consultarReservasServidor() {
  String url = backendUrl + "/api/spaces/public/status";
  String response;
  
  int httpResponseCode = makeHttpRequest(url, "GET", "", response);
  if (httpResponseCode == 200) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(2048);
#endif
    DeserializationError error = deserializeJson(doc, response);
    
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
      
      int libresLocales = 0;
      for (int j = 0; j < NUM_CAJONES; j++) {
        if (estadoFisico[j] && !reservadoServidor[j]) {
          libresLocales++;
        }
      }
      espaciosLibres = libresLocales;
    }
  }
}

void restaurarPantallaLCD() {
  if (!entradaAbierta) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SISTEMA PARKING");
    lcd.setCursor(0, 1);
    
    if (datosRecibidos) {
      lcd.print("Libres: ");
      lcd.print(espaciosLibres);
      lcd.print(" / ");
      lcd.print(espaciosTotales);
    } else if (ultimoErrorHttp != 0) {
      lcd.print("Err HTTP: ");
      lcd.print(ultimoErrorHttp);
    } else {
      lcd.print("Actualizando...");
    }
  }
}

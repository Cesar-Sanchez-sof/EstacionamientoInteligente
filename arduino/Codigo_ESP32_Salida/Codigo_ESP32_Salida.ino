#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>

// --- CONFIGURACIÓN DE RED WIFI ---
const char* ssid = "XIDI";
const char* password = "18011303";

// --- CONFIGURACIÓN DE PINES (ESP32 de 30 Pines) ---
#define SS_PIN           5
#define RST_PIN          4
#define PIN_SERVO_SAL    13
#define PIN_FC51_SAL     16

// --- ÁNGULOS DE LOS SERVOMOTORES (AJUSTABLES) ---
const int SALIDA_CERRADO  = 0;
const int SALIDA_ABIERTO  = 90;

// --- INICIALIZACIÓN DE PERIFÉRICOS ---
MFRC522 rfid(SS_PIN, RST_PIN);
Servo servoSalida;

// --- ESTADOS FÍSICOS DE LAS BARRERAS ---
bool salidaAbierta = false; 
bool bloqueoSalida = false;  

// --- VARIABLES COMPARTIDAS ENTRE NÚCLEOS (THREAD-SAFE / VOLATILE) ---
volatile bool cmdAbrirSalida = false;

// Cerrojos (latches) para evitar doble apertura desde web
bool remotoSalidaProcesado = false;  

// Cola para solicitudes de validación de RFID de salida
volatile bool rfidPendingRequest = false;
char rfidPendingUid[30] = "";

// --- TIMERS PARA EL PROCESAMIENTO ---
unsigned long lastBarrierApiTime = 0;
const unsigned long barrierApiDelay = 1500; // Polling cada 1.5s para la web

unsigned long tiempoAperturaSalida = 0;
const unsigned long duracionApertura = 5000; // 5 segundos de barrera abierta

// Declaración de funciones
void verificarBarrerasServidor();
void enviarRfidAccesoSalida(const char* uid);
void tareaNetwork(void * pvParameters);

void setup() {
  Serial.begin(115200);
  
  // 1. Inicializar Sensores y RFID
  SPI.begin();
  rfid.PCD_Init();
  pinMode(PIN_FC51_SAL, INPUT);
  
  delay(500); // Estabilización eléctrica

  // 2. Inicializar Servomotor de Salida (Cerrado por defecto)
  ESP32PWM::allocateTimer(0);
  servoSalida.setPeriodHertz(50); 
  servoSalida.attach(PIN_SERVO_SAL, 500, 2400); 
  servoSalida.write(SALIDA_CERRADO);

  // 3. Conectar a WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectando WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Conectado!");

  // 4. CREAR TAREA ASÍNCRONA EN CORE 0 PARA LLAMADAS DE RED (Evita congelar sensores/servos)
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
// NÚCLEO 1: LOOP FÍSICO DE ALTA VELOCIDAD (RFID, SERVO, SENSOR DE SALIDA)
// =========================================================================
void loop() {
  // 1. Lectura del sensor de presencia de salida (HIGH = libre, LOW = objeto detectado)
  bool objetoEnSalida = (digitalRead(PIN_FC51_SAL) == LOW);

  // 2. Lectura del lector RFID de Salida
  if (!rfidPendingRequest && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
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
    
    Serial.print("RFID Salida: Tarjeta leida - UID: ");
    Serial.println(uidString);
    
    // Copiar UID a la variable compartida para que Core 0 haga la validación en la nube
    uidString.toCharArray((char*)rfidPendingUid, sizeof(rfidPendingUid));
    rfidPendingRequest = true;

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // 3. Apertura de Salida por comando local o remoto
  if (cmdAbrirSalida) {
    cmdAbrirSalida = false;
    if (!salidaAbierta) {
      servoSalida.write(SALIDA_ABIERTO); 
      salidaAbierta = true;
      tiempoAperturaSalida = millis();
      Serial.println(">>> Barrera de SALIDA abierta.");
    }
  }

  // 4. Lógica de Cierre Automático tras 5 segundos
  if (salidaAbierta && (millis() - tiempoAperturaSalida >= duracionApertura)) {
    servoSalida.write(SALIDA_CERRADO); 
    salidaAbierta = false;
    bloqueoSalida = true;
    rfid.PCD_Init(); // Re-inicializar lector RFID por si hubo caídas de tensión por el servo
    Serial.println("RFID re-inicializado tras cierre de Salida.");
  }
  if (!objetoEnSalida) {
    bloqueoSalida = false;
  }

  delay(20);
}

// =========================================================================
// NÚCLEO 0: TAREA RED / HTTP (PROCESAMIENTO ASÍNCRONO SIN AFECTAR HARDWARE)
// =========================================================================
void tareaNetwork(void * pvParameters) {
  for(;;) {
    // 1. Procesar solicitudes pendientes de validación RFID de salida
    if (rfidPendingRequest) {
      enviarRfidAccesoSalida((const char*)rfidPendingUid);
      rfidPendingRequest = false;
    }

    // 2. Polling de barrera web de salida (cada 1.5 segundos)
    if ((millis() - lastBarrierApiTime) > barrierApiDelay || lastBarrierApiTime == 0) {
      verificarBarrerasServidor();
      lastBarrierApiTime = millis();
    }
    
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void enviarRfidAccesoSalida(const char* uid) {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    http.begin(client, "https://estacionamiento-inteligente.vercel.app/api/spaces/access/exit");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("User-Agent", "ESP32-Salida");
    
    String body = "{\"codigo_rfid\":\"" + String(uid) + "\"}";
    
    int httpResponseCode = http.POST(body);
    if (httpResponseCode == 200) {
      String payload = http.getString();
#if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
#else
      DynamicJsonDocument doc(1024);
#endif
      DeserializationError error = deserializeJson(doc, payload);
      
      if (!error) {
        bool success = doc["success"];
        String usuario = doc["usuario"];
        
        if (success) {
          cmdAbrirSalida = true;
          Serial.print(">>> Salida RFID concedida a: ");
          Serial.println(usuario);
        }
      }
    } else {
      Serial.println(">>> Salida RFID denegada. Tarjeta no valida.");
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
    http.addHeader("User-Agent", "ESP32-Salida");
    
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
          
          if (id_barrera == 2) { // Salida
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

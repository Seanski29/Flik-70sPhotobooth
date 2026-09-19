#include <Arduino.h>
#include <FastLED.h>

// --- PIN DEFINITIONS ---
const int PIN_BILL_ACCEPTOR = 2; // Hardware Interrupt Pin
const int PIN_BUTTON        = 3; // Arcade Button Switch
const int PIN_LED_ARCADE    = 4; // Arcade Button LED (Lights up at 200 PHP)
const int PIN_LED_GREEN     = 7; // Printer Success LED
const int PIN_LED_RED_SYS   = 8; // System Status (Always ON, off when ready/active)
const int PIN_WS2812        = 11; // WS2812B Data Pin
const int PIN_SWITCH_A      = 12; // Toggle Switch Left
const int PIN_SWITCH_B      = 13; // Toggle Switch Right


// --- WS2812B SETTINGS ---
const int NUM_LEDS          = 30; // Adjust to match your strip
CRGB leds[NUM_LEDS];
CRGB warmWhite = CRGB(255, 220, 140); // Default warm yellowish-white
uint8_t dimmedBrightness = 40;

// --- FINANCIAL SETTINGS ---
// The bill acceptor handles the 50 PHP math (e.g., sending 5 pulses if 1 pulse = 10 PHP).
const int phpPerPulse = 10;      

// --- STATE VARIABLES ---
volatile int totalPulses = 0; 
int currentBalance = 0;
int lastReportedBalance = -1;
bool isSessionActive = false;
String lastFilter = "";

void setup() {
  Serial.begin(115200);

  // Configure switch inputs
  pinMode(PIN_BILL_ACCEPTOR, INPUT_PULLUP);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_SWITCH_A, INPUT_PULLUP);
  pinMode(PIN_SWITCH_B, INPUT_PULLUP);

  // Configure LED outputs
  pinMode(PIN_LED_RED_SYS, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_ARCADE, OUTPUT);

  // Configure WS2812B Strip
  FastLED.addLeds<WS2812B, PIN_WS2812, GRB>(leds, NUM_LEDS);

  // Default Boot State: System Red ON, Arcade OFF, Green OFF, Strip Full Bright
  digitalWrite(PIN_LED_RED_SYS, HIGH);
  digitalWrite(PIN_LED_ARCADE, LOW);
  digitalWrite(PIN_LED_GREEN, LOW); 

  FastLED.setBrightness(200); 
  fill_solid(leds, NUM_LEDS, warmWhite);
  FastLED.show();

  attachInterrupt(digitalPinToInterrupt(PIN_BILL_ACCEPTOR), pulseInterrupt, FALLING);
  Serial.println("SYSTEM_READY");
}

void loop() {
  checkFilterState();

  currentBalance = totalPulses * phpPerPulse;

  if (currentBalance != lastReportedBalance) {
    Serial.print("BALANCE:");
    Serial.println(currentBalance);
    lastReportedBalance = currentBalance;
  }

  if (digitalRead(PIN_BUTTON) == LOW) {
    if (!isSessionActive) {
      Serial.println("BUTTON_CLICKED"); 
    }
    delay(500); 
  }
}

void checkFilterState() {
  String newFilter = "NORMAL"; 

  if (digitalRead(PIN_SWITCH_A) == LOW) {
    newFilter = "FILTER_1";
  } else if (digitalRead(PIN_SWITCH_B) == LOW) {
    newFilter = "FILTER_2";
  }

  if (newFilter != lastFilter) {
    Serial.print("FILTER:");
    Serial.println(newFilter);
    lastFilter = newFilter;
  }
}

void pulseInterrupt() {
  static unsigned long lastPulseTime = 0;
  unsigned long currentTime = millis();
  
  if (currentTime - lastPulseTime > 50) { 
    totalPulses++;
    lastPulseTime = currentTime;
  }
}

// --- FRONT-END COMMUNICATION ---
void serialEvent() {
  while (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    // --- LED LOGIC STATES ---
    if (command == "IDLE") {
       // Not enough money
       digitalWrite(PIN_LED_RED_SYS, HIGH);  
       digitalWrite(PIN_LED_ARCADE, LOW);    
       
       FastLED.setBrightness(200); // Full bright
       fill_solid(leds, NUM_LEDS, warmWhite);
       FastLED.show();
       
       isSessionActive = false;
    }
    else if (command == "READY_TO_START") {
       // 200 PHP reached
       digitalWrite(PIN_LED_RED_SYS, LOW);   
       digitalWrite(PIN_LED_ARCADE, HIGH);   
       
       FastLED.setBrightness(200); // Full bright
       fill_solid(leds, NUM_LEDS, warmWhite);
       FastLED.show();
       
       isSessionActive = false;
    } 
    else if (command == "SESSION_START") {
       // Camera is running
       digitalWrite(PIN_LED_RED_SYS, LOW);   
       digitalWrite(PIN_LED_ARCADE, LOW);    
       
       FastLED.setBrightness(dimmedBrightness);
       fill_solid(leds, NUM_LEDS, warmWhite);
       FastLED.show();
       
       isSessionActive = true;
    }
    
    // --- GREEN LED (Printer) ---
    else if (command == "GREEN_ON") {
       digitalWrite(PIN_LED_GREEN, HIGH); 
    } 
    else if (command == "GREEN_OFF") {
       digitalWrite(PIN_LED_GREEN, LOW);  
       digitalWrite(PIN_LED_RED_SYS, HIGH);
       
       FastLED.setBrightness(200); // Restore full bright
       fill_solid(leds, NUM_LEDS, warmWhite);
       FastLED.show();
    }
    else if (command.startsWith("SET_COLOR:")) {
       int red;
       int green;
       int blue;
       String values = command.substring(10);
       if (sscanf(values.c_str(), "%d,%d,%d", &red, &green, &blue) == 3 &&
           red >= 0 && red <= 255 &&
           green >= 0 && green <= 255 &&
           blue >= 0 && blue <= 255) {
          warmWhite = CRGB((uint8_t)red, (uint8_t)green, (uint8_t)blue);
          fill_solid(leds, NUM_LEDS, warmWhite);
          FastLED.show();
       }
    }
    else if (command.startsWith("SET_DIM:")) {
       int brightness = command.substring(8).toInt();
       if (brightness >= 0 && brightness <= 255) {
          dimmedBrightness = (uint8_t)brightness;
          if (isSessionActive) {
             FastLED.setBrightness(dimmedBrightness);
             FastLED.show();
          }
       }
    }
  }
}
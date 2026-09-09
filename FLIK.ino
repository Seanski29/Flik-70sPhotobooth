#include <Arduino.h>

// --- PIN DEFINITIONS ---
const int PIN_BILL_ACCEPTOR = 2; // Hardware Interrupt Pin
const int PIN_BUTTON        = 4; // Arcade Button Switch
const int PIN_LED_RED_SYS   = 5; // System Status (Always ON, off when ready/active)
const int PIN_LED_GREEN     = 6; // Printer Success LED
const int PIN_SWITCH_A      = 7; // Toggle Switch Left
const int PIN_SWITCH_B      = 8; // Toggle Switch Right
const int PIN_LED_ARCADE    = 9; // Arcade Button LED (Lights up at 200 PHP)

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

  // Default Boot State: System Red ON, Arcade OFF, Green OFF
  digitalWrite(PIN_LED_RED_SYS, HIGH);
  digitalWrite(PIN_LED_ARCADE, LOW);
  digitalWrite(PIN_LED_GREEN, LOW); 

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
       digitalWrite(PIN_LED_RED_SYS, HIGH);  // System Red ON
       digitalWrite(PIN_LED_ARCADE, LOW);    // Arcade Red OFF
       isSessionActive = false;
    }
    else if (command == "READY_TO_START") {
       // 200 PHP reached
       digitalWrite(PIN_LED_RED_SYS, LOW);   // System Red OFF
       digitalWrite(PIN_LED_ARCADE, HIGH);   // Arcade Red ON
       isSessionActive = false;
    } 
    else if (command == "SESSION_START") {
       // Camera is running
       digitalWrite(PIN_LED_RED_SYS, LOW);   // System Red OFF
       digitalWrite(PIN_LED_ARCADE, LOW);    // Arcade Red OFF
       isSessionActive = true;
    }
    
    // --- GREEN LED (Printer) ---
    else if (command == "GREEN_ON") {
       digitalWrite(PIN_LED_GREEN, HIGH); 
    } 
    else if (command == "GREEN_OFF") {
       digitalWrite(PIN_LED_GREEN, LOW);  
       // Once printer finishes, return to IDLE state (System Red ON)
       digitalWrite(PIN_LED_RED_SYS, HIGH);
    }
  }
}
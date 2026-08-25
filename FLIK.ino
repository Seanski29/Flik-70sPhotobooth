#include <Arduino.h>

// --- PIN DEFINITIONS ---
const int PIN_BILL_ACCEPTOR = 2; // Hardware Interrupt Pin (Bill Acceptor Pulse)
const int PIN_BUTTON        = 4; // Arcade Button Switch
const int PIN_LED_RED       = 5; // Arcade Button LED (Red / Ready Status)
const int PIN_LED_GREEN     = 6; // Printer Success LED (Green / Print Status)
const int PIN_SWITCH_A      = 7; // Toggle Switch Left (FILTER_1)
const int PIN_SWITCH_B      = 8; // Toggle Switch Right (FILTER_2)

// --- FINANCIAL SETTINGS ---
const int phpPerPulse = 10;      

// --- STATE VARIABLES ---
volatile int totalPulses = 0; 
int currentBalance = 0;
int lastReportedBalance = -1;
bool isSessionActive = false;
String lastFilter = "";

void setup() {
  Serial.begin(115200);

  // Configure switch inputs using internal pull-up resistors
  pinMode(PIN_BILL_ACCEPTOR, INPUT_PULLUP);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_SWITCH_A, INPUT_PULLUP);
  pinMode(PIN_SWITCH_B, INPUT_PULLUP);

  // Configure LED outputs
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);

  // Default State: Both LEDs OFF waiting for money
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, LOW); 

  // Hardware interrupt for money counting
  attachInterrupt(digitalPinToInterrupt(PIN_BILL_ACCEPTOR), pulseInterrupt, FALLING);
  
  Serial.println("SYSTEM_READY");
}

void loop() {
  // 1. Monitor filter switch state
  checkFilterState();

  // 2. Calculate and Report Balance (Server.js handles the deductions)
  currentBalance = totalPulses * phpPerPulse;

  if (currentBalance != lastReportedBalance) {
    Serial.print("BALANCE:");
    Serial.println(currentBalance);
    lastReportedBalance = currentBalance;
  }

  // 3. Listen for Arcade Button click
  if (digitalRead(PIN_BUTTON) == LOW) {
    if (!isSessionActive) {
      Serial.println("BUTTON_CLICKED"); 
    }
    delay(500); // Debounce to prevent double-clicks spamming the server
  }
}

// --- HARDWARE FUNCTIONS ---

void checkFilterState() {
  String newFilter = "NORMAL"; 

  // Read the 3-Way Switch positions
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
  
  // 50ms debounce for the bill acceptor pulses
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
    
    // --- RED LED CONTROLS (Session & Balance) ---
    if (command == "READY_TO_START") {
       digitalWrite(PIN_LED_RED, HIGH); // 200 PHP reached, light up Arcade Button
       isSessionActive = false;
    } 
    else if (command == "IDLE") {
       digitalWrite(PIN_LED_RED, LOW);  // Not enough money, keep Arcade Button off
       isSessionActive = false;
    }
    else if (command == "SESSION_START") {
       digitalWrite(PIN_LED_RED, LOW);  // Turn off Arcade Button during photo session
       isSessionActive = true;
    }
    
    // --- GREEN LED CONTROLS (Printer Status) ---
    else if (command == "GREEN_ON") {
       digitalWrite(PIN_LED_GREEN, HIGH); // Printer triggered!
    } 
    else if (command == "GREEN_OFF") {
       digitalWrite(PIN_LED_GREEN, LOW);  // 10 seconds are up
    }
  }
}
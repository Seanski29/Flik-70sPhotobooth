#include <Arduino.h>

// --- PIN DEFINITIONS ---
const int coinPin = 3;          // Bill Acceptor Pulse (Hardware Interrupt Pin)
const int buttonPin = 6;        // Arcade Button Switch (NO)
const int filterSwitch1 = 13;   // Toggle Switch Left
const int filterSwitch2 = 12;   // Toggle Switch Right
const int buttonLEDPin = 6;     // Arcade Button LED Positive (+)

// --- FINANCIAL SETTINGS ---
const int pricePerSession = 200; // Exact PHP required to start
const int phpPerPulse = 10;      // How much 1 pulse is worth

// --- STATE VARIABLES ---
volatile int totalPulses = 0; 
int currentBalance = 0;
int lastReportedBalance = -1;
bool isSessionActive = false;
String currentFilter = "NORMAL";
String lastFilter = "";

void setup() {
  Serial.begin(115200);

  // Configure switch inputs
  pinMode(coinPin, INPUT_PULLUP);
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(filterSwitch1, INPUT_PULLUP);
  pinMode(filterSwitch2, INPUT_PULLUP);

  // Configure output for Button LED
  pinMode(buttonLEDPin, OUTPUT);
  digitalWrite(buttonLEDPin, HIGH); 

  // Hardware interrupt for money counting
  attachInterrupt(digitalPinToInterrupt(coinPin), pulseInterrupt, FALLING);
  
  Serial.println("SYSTEM_READY");
}

void loop() {
  // 1. Monitor filter switches
  checkFilterState();

  // 2. Calculate and Report Balance (in Pesos)
  currentBalance = totalPulses * phpPerPulse;

  if (currentBalance != lastReportedBalance) {
    Serial.print("BALANCE:");
    Serial.println(currentBalance);
    lastReportedBalance = currentBalance;
  }

  // 3. Listen for the Arcade Button press
  if (digitalRead(buttonPin) == LOW) {
    
    Serial.println("DEBUG: BUTTON_CLICKED"); 
    
    if (!isSessionActive && currentBalance >= pricePerSession) {
      // Deduct exactly the pulses needed for 200 PHP 
      totalPulses -= (pricePerSession / phpPerPulse); 
      startPhotoSession();
      
    } else if (!isSessionActive && currentBalance < pricePerSession) {
      Serial.println("INSUFFICIENT_FUNDS"); 
    }
    
    delay(300); // Debounce to prevent double-clicks
  }
}

// --- HARDWARE FUNCTIONS ---

void checkFilterState() {
  String newFilter = "NORMAL"; 

  if (digitalRead(filterSwitch1) == LOW) {
    newFilter = "FILTER_1";
  } else if (digitalRead(filterSwitch2) == LOW) {
    newFilter = "FILTER_2";
  }

  if (newFilter != lastFilter) {
    Serial.print("FILTER:");
    Serial.println(newFilter);
    lastFilter = newFilter;
  }
}

void startPhotoSession() {
  isSessionActive = true;
  digitalWrite(buttonLEDPin, LOW); // Turn off arcade button light
  
  Serial.println("TRIGGER: START");
  Serial.print("ACTIVE_FILTER:");
  Serial.println(lastFilter);

  delay(500); 
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
    
    if (command == "SESSION_COMPLETE") {
       digitalWrite(buttonLEDPin, HIGH);   
       isSessionActive = false;            
    }
  }
}
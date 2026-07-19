// Define the pin connected to the button
const int buttonPin = 2; 

// Variables to track the button's state
int currentButtonState = 0;
int lastButtonState = HIGH; 

void setup() {
  // Initialize the Serial Monitor at 9600 baud rate
  Serial.begin(9600);
  
  // Set the pin as an input and activate the Arduino's internal pull-up resistor
  // This makes the pin read HIGH when left alone, and LOW when pressed.
  pinMode(buttonPin, INPUT_PULLUP);
  
  Serial.println("System Ready. Waiting for button press...");
}

void loop() {
  // Read the current physical state of the button
  currentButtonState = digitalRead(buttonPin);

  // Check if the state has changed since the last loop
  if (currentButtonState != lastButtonState) {
    
    // If the state is LOW, the COM and NO pins have connected (button is pressed)
    if (currentButtonState == LOW) {
      Serial.println("Red Arcade Button: PRESSED!");
    } else {
      Serial.println("Red Arcade Button: RELEASED");
    }
    
    // A tiny 50-millisecond delay to prevent "switch bounce" 
    // (the physical metal vibrating and causing multiple false readings)
    delay(50); 
  }

  // Save the current state for the next loop to compare against
  lastButtonState = currentButtonState;
}
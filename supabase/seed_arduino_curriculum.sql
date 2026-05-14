-- ============================================================
-- Seed: Arduino Starter Kit — Foundations Curriculum
-- Run this once in Supabase SQL Editor after setup.sql
-- ============================================================

-- ============================================================
-- 1. Create the Kit
-- ============================================================
INSERT INTO public.kits (id, name, description, category, total_sessions, difficulty_level, image_url)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Arduino UNO R3 Starter Kit',
  'The complete Arduino starter kit with UNO R3 board, breadboard, LEDs, resistors, sensors, and all components needed for 9 foundational projects.',
  'robotics',
  9,
  'beginner',
  NULL
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Create the Program
-- ============================================================
INSERT INTO public.programs (id, kit_id, title, description, difficulty_level, category, estimated_hours, total_sessions, image_url)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Arduino Foundations',
  'Master the fundamentals of Arduino programming and electronics. From installing the IDE to reading RFID tags, this program takes you from absolute beginner to confident maker. Each session builds on the previous one with hands-on projects and code examples.',
  'beginner',
  'robotics',
  8,
  9,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Helper function to insert content blocks for a session
-- ============================================================
DO $$
DECLARE
  ses_id UUID;
  prog_id CONSTANT UUID := 'b0000000-0000-0000-0000-000000000001';
BEGIN

-- ============================================================
-- Session 0: Installing the Arduino IDE (FREE)
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000000';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'Installing the Arduino IDE', 'Download, install, and configure the Arduino IDE. Learn about the COM port and board selection.', 0, true, 25, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Welcome to Arduino!',
 'Welcome to the world of Arduino! In this first session, you will set up your development environment. The Arduino IDE (Integrated Development Environment) is where you will write, compile, and upload code to your Arduino board.'),
(ses_id, 'text', 2, 'What is the Arduino IDE?',
 'The Arduino IDE is a cross-platform application written in Java. It includes a code editor with syntax highlighting, a message area, a text console, and a toolbar with buttons for common functions. It connects to the Arduino hardware to upload programs and communicate with them.'),
(ses_id, 'code', 3, 'Your First Sketch Template',
 'Every Arduino sketch has two essential functions:

void setup() {
  // Runs once at startup
  // Configure pins, serial, etc.
}

void loop() {
  // Runs repeatedly forever
  // Main program logic
}'),
(ses_id, 'text', 4, 'Installing — Step by Step',
 '1. Go to arduino.cc/en/software
2. Download the version for your OS (Windows, macOS, Linux)
3. Run the installer
4. Launch the Arduino IDE
5. Connect your Arduino UNO via USB
6. Go to Tools → Board → Arduino UNO
7. Go to Tools → Port and select the correct COM port (Windows) or /dev/cu.usbmodem (macOS)'),
(ses_id, 'tip', 5, 'COM Port Troubleshooting',
 'If no port appears, you may need to install the CH340/CP210x driver (common on clone boards). On Windows, check Device Manager under "Ports (COM & LPT)". On macOS, check /dev/ in Terminal.'),
(ses_id, 'code', 6, 'Test Your Setup — Blink',
 'Upload this test sketch to verify everything works:

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}

After uploading, the built-in LED on pin 13 should blink every second.');

-- Session 0 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'Installing the Arduino IDE Quiz',
'[
  {"id":"s0q1","question":"What does IDE stand for?","options":["Integrated Development Environment","Internal Design Editor","Input-Output Device Emulator","Interface Definition Engine"],"correct_index":0},
  {"id":"s0q2","question":"What are the two mandatory functions in every Arduino sketch?","options":["start() and loop()","setup() and loop()","init() and run()","begin() and repeat()"],"correct_index":1},
  {"id":"s0q3","question":"What is a COM port?","options":["A type of USB cable","The serial port your Arduino connects to","An internet protocol","A power supply rating"],"correct_index":1}
]'::jsonb, 70);

-- ============================================================
-- Session 1: Libraries & Serial Monitor (FREE)
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000001';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'Libraries & Serial Monitor', 'Learn what Arduino libraries are, how to install them via the Library Manager, and how to use the Serial Monitor for debugging.', 1, true, 30, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Why Libraries Matter',
 'Libraries are collections of pre-written code that make it easy to control complex hardware. Instead of writing low-level commands to talk to an LCD screen, you install a library and call simple functions like lcd.print().'),
(ses_id, 'text', 2, 'Installing a Library',
 '1. In the Arduino IDE, go to Tools → Manage Libraries (or Ctrl+Shift+I)
2. Search for the library you need
3. Click Install
4. Add #include <LibraryName.h> at the top of your sketch'),
(ses_id, 'code', 3, 'Serial Monitor — Hello World',
 'The Serial Monitor lets your Arduino send text to your computer:

void setup() {
  Serial.begin(9600);   // Start serial at 9600 baud
  Serial.println("Hello from Arduino!");
}

void loop() {
  Serial.print("Uptime: ");
  Serial.println(millis());
  delay(1000);
}

Open Tools → Serial Monitor (Ctrl+Shift+M) to see the output.'),
(ses_id, 'tip', 4, 'Baud Rate Matching',
 'The baud rate in Serial.begin() MUST match the baud rate selected in the Serial Monitor (bottom-right corner). 9600 is the standard and works for most cases.'),
(ses_id, 'code', 5, 'Reading Input from Serial',
 'You can also send commands FROM your computer TO the Arduino:

void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    Serial.print("You sent: ");
    Serial.println(cmd);
  }
}

Type a character in the Serial Monitor and hit Send.');

-- Session 1 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'Libraries & Serial Monitor Quiz',
'[
  {"id":"s1q1","question":"How do you install an Arduino library?","options":["Download from a website and copy files","Use Tools → Manage Libraries","Type install library in Serial Monitor","It comes pre-installed"],"correct_index":1},
  {"id":"s1q2","question":"What does Serial.begin(9600) do?","options":["Stops serial communication","Starts serial communication at 9600 bits per second","Sends a beep at 9600 Hz","Sets pin 9600 to output"],"correct_index":1},
  {"id":"s1q3","question":"What is the Serial Monitor used for?","options":["Watching voltage levels","Debugging and communicating with Arduino","Monitoring Wi-Fi signals","Viewing the circuit diagram"],"correct_index":1}
]'::jsonb, 70);

-- ============================================================
-- Session 2: Blink — Built-in LED
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000002';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'Blink — Built-in LED', 'Understand the setup()/loop() structure, digital output with pinMode() and digitalWrite(), and timing with delay(). Your first real Arduino program.', 2, false, 20, 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Making Your First LED Blink',
 'The "Blink" sketch is the Hello World of Arduino. You will control the built-in LED on pin 13 of the Arduino UNO. This teaches you the core concepts that every Arduino program uses.'),
(ses_id, 'text', 2, 'Understanding the Code Structure',
 'Every Arduino sketch has two required functions:
• setup() — runs once at power-up or reset. Used to configure pins.
• loop() — runs continuously. The main program logic goes here.

Arduino executes setup() first, then calls loop() over and over.'),
(ses_id, 'code', 3, 'Blink Sketch — Explained',
 'void setup() {
  // Configure pin 13 as an OUTPUT
  // OUTPUT means the pin will send voltage (not read it)
  pinMode(LED_BUILTIN, OUTPUT);
  // LED_BUILTIN is a constant equal to 13 on UNO
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  // HIGH = 5 volts — LED turns ON
  delay(1000);
  // Wait 1000 milliseconds (1 second)

  digitalWrite(LED_BUILTIN, LOW);
  // LOW = 0 volts — LED turns OFF
  delay(1000);
  // Wait another second
}'),
(ses_id, 'tip', 4, 'LED_BUILTIN vs Pin 13',
 'LED_BUILTIN is a constant defined by Arduino for each board. On the UNO it is pin 13. Using LED_BUILTIN makes your code portable across different Arduino boards.'),
(ses_id, 'code', 5, 'Challenge: Change the Speed',
 'Try modifying the delay values to create different blink patterns:

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(200);       // On for 0.2 seconds
  digitalWrite(LED_BUILTIN, LOW);
  delay(200);       // Off for 0.2 seconds
}

This creates a fast blink — like a heartbeat!');

-- Session 2 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'Blink — Built-in LED Quiz',
'[
  {"id":"s2q1","question":"What does pinMode() do?","options":["Sets a pin as INPUT or OUTPUT","Reads the voltage on a pin","Writes a value to a pin","Deletes a pin from memory"],"correct_index":0},
  {"id":"s2q2","question":"What do HIGH and LOW mean?","options":["High/low volume","5V (ON) and 0V (OFF)","Fast and slow","Positive and negative numbers"],"correct_index":1},
  {"id":"s2q3","question":"What does delay(1000) do?","options":["Runs the program 1000 times","Waits for 1000 milliseconds (1 second)","Sets pin 1000 to output","Sends 1000 bytes to serial"],"correct_index":1}
]'::jsonb, 70);

-- ============================================================
-- Session 3: External LED + Resistor
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000003';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'External LED + Resistor', 'Build your first circuit on a breadboard. Learn about LED polarity (anode vs cathode), resistor color codes, and Ohm''s Law.', 3, false, 35, 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'From Built-in to External',
 'Now that you have controlled the built-in LED, it is time to build your own external circuit. You will use a breadboard, an LED, and a resistor.'),
(ses_id, 'components', 2, 'Bill of Materials',
 '• 1 x LED (any color — red is best for beginners)
• 1 x 220Ω resistor (red-red-brown-gold)
• 2 x jumper wires
• 1 x breadboard
• 1 x Arduino UNO'),
(ses_id, 'text', 3, 'LED Polarity — Anode vs Cathode',
 'An LED has two legs:
• ANODE (+): The LONGER leg. Connects to positive voltage.
• CATHODE (-): The SHORTER leg. Connects to ground (GND).

The flat side of the LED body also marks the cathode. Always connect the resistor in series with the LED to limit current.'),
(ses_id, 'diagram', 4, 'Wiring Diagram',
 'Arduino Pin 9 → Jumper Wire → Breadboard Row A1
Row A1 → 220Ω Resistor → Breadboard Row A5
Row A5 → LED Anode (long leg)
LED Cathode (short leg) → Breadboard Row A10
Row A10 → Jumper Wire → Arduino GND'),
(ses_id, 'code', 5, 'External LED Blink',
 'int ledPin = 9;  // Using PWM-capable pin 9

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
}'),
(ses_id, 'safety_note', 6, 'Why the Resistor is Essential',
 'An LED without a current-limiting resistor will draw too much current and burn out — possibly damaging the Arduino pin. The 220Ω resistor limits current to approximately 15mA, which is safe for both the LED and the Arduino. This is Ohm''s Law: I = V / R = 5V / 220Ω ≈ 23mA.'),
(ses_id, 'tip', 7, 'Reading Resistor Color Codes',
 '220Ω resistor bands: Red (2), Red (2), Brown (×10), Gold (±5%)
Quick trick: "Red Red Brown" = 22 × 10 = 220 ohms.
Other common values: 330Ω (Orange Orange Brown), 10kΩ (Brown Black Orange).');

-- Session 3 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'External LED + Resistor Quiz',
'[
  {"id":"s3q1","question":"Which leg of an LED is the anode?","options":["The shorter leg","The longer leg","The leg with a flat side","Neither — LEDs have no polarity"],"correct_index":1},
  {"id":"s3q2","question":"Why do we need a resistor with an LED?","options":["To make the LED brighter","To limit current and prevent burning out the LED","To reduce the voltage from 5V to 3.3V","Resistors are optional"],"correct_index":1},
  {"id":"s3q3","question":"What does the brown band on a 220Ω resistor represent?","options":["2","1 (multiplier = ×10)","5% tolerance","220"],"correct_index":0}
]'::jsonb, 70);

-- ============================================================
-- Session 4: RGB LED
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000004';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'RGB LED', 'Learn analog output with analogWrite() and PWM pins. Mix red, green, and blue to create millions of colors.', 4, false, 35, 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Millions of Colors from Three LEDs',
 'An RGB LED contains three LEDs (red, green, blue) in a single package. By controlling the brightness of each color using PWM, you can create any color.'),
(ses_id, 'components', 2, 'Bill of Materials',
 '• 1 x RGB LED (common cathode)
• 3 x 220Ω resistors
• 4 x jumper wires
• 1 x breadboard'),
(ses_id, 'text', 3, 'Common Cathode vs Common Anode',
 'RGB LEDs come in two types:
• Common Cathode (−): One shared ground pin. You apply positive voltage to each color pin.
• Common Anode (+): One shared power pin. You apply ground to each color pin (inverted logic).

Most starter kits include common cathode RGB LEDs. The longest pin is the common pin.'),
(ses_id, 'diagram', 4, 'Wiring Diagram (Common Cathode)',
 'RGB LED Pinout (flat side facing you):
  Pin 1 (Red)   → 220Ω → Arduino Pin 9
  Pin 2 (Common) → Arduino GND
  Pin 3 (Green) → 220Ω → Arduino Pin 10
  Pin 4 (Blue)  → 220Ω → Arduino Pin 11');
INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content, code_language) VALUES
(ses_id, 'code', 5, 'RGB Color Mixing', 'int redPin = 9;
int greenPin = 10;
int bluePin = 11;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  // Red
  setColor(255, 0, 0);
  delay(1000);

  // Green
  setColor(0, 255, 0);
  delay(1000);

  // Blue
  setColor(0, 0, 255);
  delay(1000);

  // Yellow (Red + Green)
  setColor(255, 255, 0);
  delay(1000);

  // Cyan (Green + Blue)
  setColor(0, 255, 255);
  delay(1000);

  // Purple (Red + Blue)
  setColor(255, 0, 255);
  delay(1000);

  // White (all three)
  setColor(255, 255, 255);
  delay(1000);
}

void setColor(int red, int green, int blue) {
  analogWrite(redPin, red);
  analogWrite(greenPin, green);
  analogWrite(bluePin, blue);
}', 'arduino');
INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'tip', 6, 'PWM Explained',
 'analogWrite() does NOT output a variable voltage. Instead, it rapidly switches the pin on and off (Pulse Width Modulation). A value of 255 = always on, 0 = always off, 127 = on half the time. The LED''s persistence of vision blends this into perceived brightness.
PWM-capable pins on Arduino UNO: 3, 5, 6, 9, 10, 11 (marked with ~).');

-- Session 4 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'RGB LED Quiz',
'[
  {"id":"s4q1","question":"Which pins on Arduino UNO support PWM (analogWrite)?","options":["0, 1, 2, 3, 4, 5","3, 5, 6, 9, 10, 11","All pins","A0 through A5"],"correct_index":1},
  {"id":"s4q2","question":"How do you make yellow using an RGB LED?","options":["Red + Green","Red + Blue","Green + Blue","Red + Green + Blue"],"correct_index":0},
  {"id":"s4q3","question":"What does analogWrite(127) do?","options":["Outputs 1.27V","Turns the pin on 50% of the time (PWM)","Sets pin 127 as output","Writes the number 127 to Serial"],"correct_index":1}
]'::jsonb, 70);

-- ============================================================
-- Session 5: Active Buzzer
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000005';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'Active Buzzer', 'Generate sound with a DC-powered active buzzer. Learn the difference between active and passive buzzers.', 5, false, 20, 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Adding Sound to Your Projects',
 'Buzzers let your Arduino communicate with sound. An active buzzer has a built-in oscillator — just apply power and it makes sound at a fixed frequency.'),
(ses_id, 'components', 2, 'Bill of Materials',
 '• 1 x Active Buzzer (usually has a sticker on top)
• 2 x jumper wires
• 1 x breadboard'),
(ses_id, 'text', 3, 'Active vs Passive Buzzers',
 '• Active Buzzer: Has an internal tone generator. Apply DC voltage → produces sound at a fixed frequency (typically ~2.5kHz). Simpler to use but limited to one tone.
• Passive Buzzer: No internal oscillator. Needs a square wave signal (using tone()). Can play different frequencies and melodies.

How to tell them apart: Active buzzers often have a sticker covering the sound hole. Passive buzzers are usually open.'),
(ses_id, 'diagram', 4, 'Wiring',
 'Active Buzzer (+) pin → Arduino Pin 8
Active Buzzer (−) pin → Arduino GND'),
(ses_id, 'code', 5, 'Simple Buzzer Tone',
 'int buzzerPin = 8;

void setup() {
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  // Alternating beeps
  digitalWrite(buzzerPin, HIGH);
  delay(500);
  digitalWrite(buzzerPin, LOW);
  delay(500);
}'),
(ses_id, 'tip', 6, 'Making Siren Sounds',
 'To make a siren effect with an active buzzer, use a transistor to allow faster switching, or switch to a passive buzzer and use the tone() function for variable frequencies.');

-- Session 5 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'Active Buzzer Quiz',
'[
  {"id":"s5q1","question":"What is the main difference between an active and passive buzzer?","options":["Active is louder","Active has a built-in oscillator; passive needs a signal","Active needs AC power; passive uses DC","Passive buzzers are red; active are black"],"correct_index":1},
  {"id":"s5q2","question":"How do you turn on an active buzzer?","options":["Use analogWrite()","Use tone()","Use digitalWrite(HIGH)","Use Serial.print()"],"correct_index":2}
]'::jsonb, 70);

-- ============================================================
-- Session 6: Passive Buzzer
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000006';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'Passive Buzzer', 'Play melodies using the tone() function. Map frequencies to musical notes and never use analogWrite() on a buzzer.', 6, false, 30, 22)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Making Music with Arduino',
 'A passive buzzer can play different frequencies, which means you can play actual musical notes and melodies. The tone() function generates a square wave at any frequency you specify.'),
(ses_id, 'components', 2, 'Bill of Materials',
 '• 1 x Passive Buzzer (no sticker)
• 2 x jumper wires
• 1 x breadboard'),
(ses_id, 'text', 3, 'Musical Note Frequencies',
 'Middle C (C4) = 262 Hz
D4 = 294 Hz    E4 = 330 Hz
F4 = 349 Hz    G4 = 392 Hz
A4 = 440 Hz    B4 = 494 Hz
C5 = 523 Hz

The formula: frequency = 1 / period. For A4 (440 Hz), one cycle = 1/440 ≈ 2.27ms.'),
(ses_id, 'diagram', 4, 'Wiring',
 'Passive Buzzer (+) pin → Arduino Pin 8
Passive Buzzer (−) pin → Arduino GND

(Wiring is identical to active — only the code changes!)'),
(ses_id, 'code', 5, 'Playing Notes with tone()',
 'int buzzerPin = 8;

// Note frequencies (Hz)
#define NOTE_C4 262
#define NOTE_D4 294
#define NOTE_E4 330
#define NOTE_F4 349
#define NOTE_G4 392
#define NOTE_A4 440
#define NOTE_B4 494
#define NOTE_C5 523

void setup() {
  // tone() does NOT need pinMode
}

void loop() {
  // Play a scale
  tone(buzzerPin, NOTE_C4);
  delay(500);
  tone(buzzerPin, NOTE_D4);
  delay(500);
  tone(buzzerPin, NOTE_E4);
  delay(500);
  tone(buzzerPin, NOTE_F4);
  delay(500);
  tone(buzzerPin, NOTE_G4);
  delay(500);
  tone(buzzerPin, NOTE_A4);
  delay(500);
  tone(buzzerPin, NOTE_B4);
  delay(500);
  tone(buzzerPin, NOTE_C5);
  delay(500);

  noTone(buzzerPin);  // Stop
  delay(1000);
}'),
(ses_id, 'safety_note', 6, 'Never use analogWrite() on a buzzer',
 'Do NOT use analogWrite() with a buzzer. PWM runs at ~490Hz or ~980Hz, which is not a clean audio signal and can damage the buzzer or produce distorted sound. Always use tone() for passive buzzers.'),
(ses_id, 'tip', 7, 'tone() Limitations',
 'The tone() function can only play one frequency at a time (monophonic). Using tone() on multiple pins simultaneously will cause unexpected behavior. Use only one buzzer at a time.
Use noTone(pin) to stop the sound.');

-- Session 6 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'Passive Buzzer Quiz',
'[
  {"id":"s6q1","question":"Which function do you use to play a frequency on a passive buzzer?","options":["digitalWrite()","analogWrite()","tone()","playNote()"],"correct_index":2},
  {"id":"s6q2","question":"What frequency is Middle C (C4)?","options":["262 Hz","440 Hz","523 Hz","1000 Hz"],"correct_index":0},
  {"id":"s6q3","question":"Why should you NOT use analogWrite() on a buzzer?","options":["It is too loud","It produces distorted sound and can damage the buzzer","It only works with active buzzers","It drains the battery faster"],"correct_index":1}
]'::jsonb, 70);

-- ============================================================
-- Session 7: Tilt Switch
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000007';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'Tilt Switch', 'Read digital input using INPUT_PULLUP. Understand how a tilt switch works and use it to detect orientation.', 7, false, 25, 25)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Detecting Motion and Orientation',
 'A tilt switch (also called a tilt sensor or ball switch) contains a small metal ball that rolls and makes contact with two pins when tilted in a certain direction. It is a simple digital input device.'),
(ses_id, 'components', 2, 'Bill of Materials',
 '• 1 x Tilt Switch (mercury-free, ball-type)
• 2 x jumper wires
• 1 x breadboard
• 1 x LED (optional, for visual feedback)
• 1 x 220Ω resistor (optional)'),
(ses_id, 'text', 3, 'How a Tilt Switch Works',
 'Inside the tilt switch is a metal ball and two contacts:
• Upright position: Ball rests at the bottom, contacts are OPEN → the pin reads HIGH.
• Tilted position: Ball rolls and bridges the contacts → the pin reads LOW (connected to GND).

We use INPUT_PULLUP so the pin reads HIGH when the switch is open, and LOW when the switch is closed (tilted).'),
(ses_id, 'diagram', 4, 'Wiring',
 'Tilt Switch Pin 1 → Arduino Pin 2
Tilt Switch Pin 2 → Arduino GND

No external resistor needed — INPUT_PULLUP enables the internal 20kΩ pull-up resistor.'),
(ses_id, 'code', 5, 'Tilt Detection',
 'int tiltPin = 2;
int ledPin = 13;
int tiltState = 0;

void setup() {
  pinMode(tiltPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  tiltState = digitalRead(tiltPin);

  if (tiltState == HIGH) {
    Serial.println("Upright");
    digitalWrite(ledPin, LOW);
  } else {
    Serial.println("TILTED!");
    digitalWrite(ledPin, HIGH);
  }

  delay(100);  // Debounce
}'),
(ses_id, 'tip', 6, 'What is INPUT_PULLUP?',
 'Arduino has built-in pull-up resistors (20kΩ) that can be enabled with INPUT_PULLUP. This eliminates the need for an external resistor. When the switch is open, the pin is pulled HIGH. When the switch closes to GND, the pin reads LOW.
INPUT_PULLUP is the standard way to connect buttons and switches.');

-- Session 7 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'Tilt Switch Quiz',
'[
  {"id":"s7q1","question":"What does INPUT_PULLUP do?","options":["Connects the pin to 5V through a resistor","Enables the internal 20kΩ pull-up resistor","Makes the pin output high","Disables the pin"],"correct_index":1},
  {"id":"s7q2","question":"What does a tilt switch read when it is upright?","options":["LOW (0)","HIGH (1)","It alternates","Floating (undefined)"],"correct_index":1},
  {"id":"s7q3","question":"Why do we not need an external resistor with INPUT_PULLUP?","options":["Tilt switches have built-in resistors","The Arduino has an internal pull-up resistor","No resistor is ever needed","The LED provides resistance"],"correct_index":1}
]'::jsonb, 70);

-- ============================================================
-- Session 8: RFID RC522
-- ============================================================
ses_id := 'c0000000-0000-0000-0000-000000000008';
INSERT INTO public.sessions (id, program_id, title, description, session_order, is_free, duration_minutes, xp_cost)
VALUES (ses_id, prog_id, 'RFID RC522', 'Read RFID card and tag UIDs using the RC522 module over SPI protocol. Learn about SPI wiring and the MFRC522 library.', 8, false, 40, 28)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'introduction', 1, 'Wireless Identification with RFID',
 'Radio Frequency Identification (RFID) uses electromagnetic fields to identify tags and cards. The RC522 module operates at 13.56 MHz and communicates with the Arduino via SPI protocol. This is the same technology used in access cards, key fobs, and payment systems.'),
(ses_id, 'components', 2, 'Bill of Materials',
 '• 1 x RC522 RFID Module
• 1 x RFID Card + Key Fob
• 7 x jumper wires (female-to-male recommended)
• 1 x breadboard'),
(ses_id, 'text', 3, 'SPI Protocol — How It Works',
 'SPI (Serial Peripheral Interface) uses 4 wires:
• SS (Slave Select) — Chip select, usually pin 10
• MOSI (Master Out Slave In) — Data from Arduino to module, pin 11
• MISO (Master In Slave Out) — Data from module to Arduino, pin 12
• SCK (Serial Clock) — Clock signal, pin 13

SPI is faster than I2C but uses more pins. The MFRC522 library handles all the low-level SPI communication.'),
(ses_id, 'diagram', 4, 'RC522 Wiring',
 'RC522 Pin → Arduino Pin
  SDA(SS)  → 10
  SCK      → 13
  MOSI     → 11
  MISO     → 12
  IRQ      → (not connected)
  GND      → GND
  RST      → 9
  3.3V     → 3.3V (NOT 5V!)

⚠ The RC522 is a 3.3V device. Do NOT connect VCC to 5V or you will damage the module.');

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content, code_language) VALUES
(ses_id, 'code', 5, 'Read RFID UID',
 '#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("Place your card near the reader...");
}

void loop() {
  // Look for a new card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // Read the card
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Print the UID
  Serial.print("Card UID: ");
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    Serial.print(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(mfrc522.uid.uidByte[i], HEX);
  }
  Serial.println();

  delay(1000);
}', 'arduino');

INSERT INTO public.content_blocks (session_id, block_type, block_order, title, content) VALUES
(ses_id, 'text', 6, 'Understanding the UID',
 'Each RFID card and tag has a unique 4-byte (or 7-byte) UID (Unique Identifier). This is like a serial number burned into the chip during manufacturing. You can use this UID to identify specific users or grant access.

The MFRC522 can read the UID and also read/write data to the card''s memory sectors (with the right authentication keys).'),
(ses_id, 'tip', 7, 'Installing the MFRC522 Library',
 'You MUST install the MFRC522 library:
1. Tools → Manage Libraries
2. Search for "MFRC522"
3. Install by Miguel Balboa
4. Add #include <SPI.h> and #include <MFRC522.h> at the top of your sketch'),
(ses_id, 'safety_note', 8, '3.3V Only!',
 'The RC522 module operates at 3.3V. Connecting it to 5V will permanently damage the chip. If your Arduino UNO''s 3.3V pin cannot supply enough current (the RC522 draws ~30mA when active), use a separate 3.3V regulator.');

-- Session 8 Quiz
INSERT INTO public.session_quizzes (session_id, title, questions, passing_score) VALUES
(ses_id, 'RFID RC522 Quiz',
'[
  {"id":"s8q1","question":"What communication protocol does the RC522 use?","options":["I2C","SPI","UART","1-Wire"],"correct_index":1},
  {"id":"s8q2","question":"What voltage should the RC522 be powered with?","options":["5V","3.3V","12V","1.8V"],"correct_index":1},
  {"id":"s8q3","question":"What frequency does the RC522 operate at?","options":["125 kHz","13.56 MHz","433 MHz","2.4 GHz"],"correct_index":1},
  {"id":"s8q4","question":"What is a UID?","options":["Unique Identifier — the card''s unique serial number","Universal Input Device","USB Interface Driver","Under-voltage Identification"],"correct_index":0}
]'::jsonb, 70);

-- ============================================================
-- 3. Update total_sessions count
-- ============================================================
UPDATE public.kits SET total_sessions = 9 WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.programs SET total_sessions = 9 WHERE id = prog_id;

RAISE NOTICE '✅ Arduino Foundations curriculum seeded successfully!';
END $$;

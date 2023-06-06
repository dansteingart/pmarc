#include <WiFi.h>
#include <PubSubClient.h>
#include "settings.h"
#include <ArduinoJson.h>
#include <ArduinoJson.hpp>
#include "heltec.h"


// the OLED used
StaticJsonDocument<1000> doc;

#define RXD2 13
#define TXD2 12

WiFiClient espClient;
PubSubClient client(espClient);
void callback(char* topic, byte* payload, unsigned int length);

const int MESSAGE_COUNT_THRESHOLD = 100;
unsigned long last_message_time = 0;
int message_count = 0;

void setup() {

  Heltec.begin(true /*DisplayEnable Enable*/, false /*LoRa Disable*/, true /*Serial Enable*/);
  Heltec.display->setFont(ArialMT_Plain_16);
    status("Connecto to WiFi...");

  Serial.begin(115200);

  // Connect to Wi-Fi network
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }

  Serial.println("Connected to WiFi");
  status("Connected to Wifi");
  // Connect to MQTT broker
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  reconnect();
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);

}


void reconnect()
{
    while (!client.connected()) {
    Serial.println("Connecting to MQTT broker...");
    if (client.connect(mqtt_name)) {
      Serial.println("Connected to MQTT broker");
      client.subscribe(mqtt_recv);
      Serial.print("Subscribed to topic: ");
      Serial.println(mqtt_recv);

    } else {
      Serial.print("Failed to connect to MQTT broker, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }

}

float T15;
float TC;
float setpoint;



void loop() {
  if (Serial2.available() > 0) {
    // Read the incoming message
    String message = Serial2.readStringUntil('\n');
    message.trim();
    Serial.println(message);


    // Check if 1 second has passed since the last message was sent
      if (millis() - last_message_time >= 1000) {
      DeserializationError error = deserializeJson(doc, message);
        if (doc.containsKey("T15"))         T15 = doc["T15"];
        if (doc.containsKey("TC"))          TC = doc["TC"];
        if (doc.containsKey("setpoint"))    setpoint = doc["setpoint"];

        Heltec.display->clear();
        Heltec.display->setTextAlignment(TEXT_ALIGN_LEFT);
        dispT(T15,"T15:",0);
        dispT(TC,"TC:",20);
        dispT(setpoint,"S:",40);
        Heltec.display->display();

        // Publish the message to the MQTT broker
        client.publish(mqtt_send, message.c_str());

        // Reset the last message time
        last_message_time = millis();
      }
    }

  if (Serial.available() > 0) { 
    while (Serial.available() > 0) Serial2.print(Serial.read());
  }


  // Check for incoming MQTT messages
  if (!client.connected()) reconnect();
  client.loop();
}

void callback(char* topic, byte* payload, unsigned int length) {
  for (int i=0;i<length;i++) {
    Serial.print((char)payload[i]);
    Serial2.print((char)payload[i]);

  }
  
  Serial.println();
  Serial2.println();
  

}


void status(String stat)
{
    Heltec.display->clear();
    Heltec.display->drawString(0, 0, stat);
    Heltec.display->display();

}


void dispT(float aV, String lV, int y )
{
    Heltec.display->drawString(0, y, lV);
    Heltec.display->drawString(40, y, String(aV,3));
    Heltec.display->drawString(100, y, " C");
}

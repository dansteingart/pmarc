#include <Wire.h>
#include <Adafruit_I2CDevice.h>
#include <Adafruit_I2CRegister.h>
#include "Adafruit_MCP9600.h"
#include <ArduinoJson.h>
#include <ArduinoJson.hpp>
#include <AutoPID.h>

#define OUTPUT_MIN 0
#define OUTPUT_MAX 255
#define KP 10
#define KI .05
#define KD 0

double temperature, setPoint, outputVal;
double kp,ki,kd;


AutoPID myPID(&temperature, &setPoint, &outputVal, OUTPUT_MIN, OUTPUT_MAX, KP, KI, KD);

StaticJsonDocument<500> doc;
StaticJsonDocument<500> out;
String inputString = "";         // a String to hold incoming data
bool stringComplete = false;  // whether the string is complete
long last;


#define I2C_ADDRESS (0x67)
Adafruit_MCP9600 mcp;

void setup()
{

    kp = KP;
    ki = KI;
    kd = KD;

    //analogReadResolution(14);
    myPID.setBangBang(5);
    myPID.setTimeStep(100);
    

    Serial.begin(115200);
    while (!Serial) {
      delay(10);
    }
    Serial.println("MCP9600 HW test");

    /* Initialise the driver with I2C_ADDRESS and the default I2C bus. */
    if (! mcp.begin(I2C_ADDRESS)) {
        Serial.println("Sensor not found. Check wiring!");
        while (1);
    }

  Serial.println("Found MCP9600!");

  mcp.setADCresolution(MCP9600_ADCRESOLUTION_12);
  Serial.print("ADC resolution set to ");
  switch (mcp.getADCresolution()) {
    case MCP9600_ADCRESOLUTION_18:   Serial.print("18"); break;
    case MCP9600_ADCRESOLUTION_16:   Serial.print("16"); break;
    case MCP9600_ADCRESOLUTION_14:   Serial.print("14"); break;
    case MCP9600_ADCRESOLUTION_12:   Serial.print("12"); break;
  }
  Serial.println(" bits");

  mcp.setThermocoupleType(MCP9600_TYPE_K);
  Serial.print("Thermocouple type set to ");
  switch (mcp.getThermocoupleType()) {
    case MCP9600_TYPE_K:  Serial.print("K"); break;
    case MCP9600_TYPE_J:  Serial.print("J"); break;
    case MCP9600_TYPE_T:  Serial.print("T"); break;
    case MCP9600_TYPE_N:  Serial.print("N"); break;
    case MCP9600_TYPE_S:  Serial.print("S"); break;
    case MCP9600_TYPE_E:  Serial.print("E"); break;
    case MCP9600_TYPE_B:  Serial.print("B"); break;
    case MCP9600_TYPE_R:  Serial.print("R"); break;
  }
  Serial.println(" type");

  mcp.setFilterCoefficient(3);
  Serial.print("Filter coefficient value set to: ");
  Serial.println(mcp.getFilterCoefficient());

  mcp.setAlertTemperature(1, 30);
  Serial.print("Alert #1 temperature set to ");
  Serial.println(mcp.getAlertTemperature(1));
  mcp.configureAlert(1, true, true);  // alert 1 enabled, rising temp

  mcp.enable(true);

  Serial.println(F("------------------------------"));
}


long send_period = 500;
int hlevel = 0;
bool pidder = false;

float a13adder = 0;
float a14adder = 0;
float a15adder = 0;
float counter = 0;


float Tt(float Vin)
{
    float Rf = 4700;  //per https://reprap.org/mediawiki/images/f/f6/RAMPS1.4schematic.png
    float B = 3950;
    float T_ref = 298;
    float R_ref = 100000;
    float Rt = -Rf/((-1023/Vin) + 1);
    float R_ratio = Rt / R_ref;
    float log_ratio = log(R_ratio);
    float inv_temp = (1/T_ref) + (1/B) * log_ratio;
    float T = (1/inv_temp) - 273.15;  // convert to degrees Celsius
    return T;
}


void loop()
{

    if (Serial.available() > 0)
    {
      DeserializationError error = deserializeJson(doc, Serial);
      if (doc.containsKey("pwm"))    
      {
        hlevel = doc["pwm"];
        doc.remove("pwm");
        analogWrite(10,hlevel);
        pidder = false;
      }

      if (doc.containsKey("setpoint"))
      {
        setPoint = doc["setpoint"];
        pidder = true;
        doc.remove("setpoint");
      }

      if (doc.containsKey("setpid"))
      {
        
        kp = doc["kp"];
        ki = doc["ki"];
        kd = doc["kd"];
        myPID.setGains(doc["kp"],doc["ki"],doc["kd"]);
        doc.remove("setpid");
      }


    }

    a13adder += analogRead(A13); 
    a14adder += analogRead(A14);
    a15adder += analogRead(A15);
    counter += 1;

  
  if (( millis() - last) > send_period)
  {

    //average and send
    out["a13"] = a13adder/counter;
    out["a14"] = a14adder/counter;
    out["a15"] = a15adder/counter;
    // out["counter"] = counter;
    // out["millis"] = millis();
    // out["last"] = last;
    out["T13"] = Tt(out["a13"]);
    out["T14"] = Tt(out["a14"]);
    out["T15"] = Tt(out["a15"]);

    out["kp"] = kp;
    out["ki"] = ki;
    out["kd"] = kd;

    out["setpoint"] = setPoint;
    out["pidder"] = pidder;
    a13adder = 0;
    a14adder = 0;
    a15adder = 0;
    counter = 0;

    out["TC"] = mcp.readThermocouple();
    out["TA"] = mcp.readAmbient();
    out["PWM"] = hlevel;
    last = millis();
    serializeJson(out, Serial);
    Serial.println();
    if (pidder)
    {
      temperature = out["T15"];
      myPID.run();
      hlevel = outputVal; 
    }

  }

  analogWrite(10,hlevel);

}





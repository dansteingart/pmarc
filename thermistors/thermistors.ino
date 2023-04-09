#include <ArduinoJson.h>
#include <ArduinoJson.hpp>
#include <math.h>
#include "circuit.h"

StaticJsonDocument<1000> out;
int last;

void setup()
{
    Serial.begin(115200);
    last = micros();
  analogReadResolution(14); //set read to 14 bits

}

float Tt(float Vin)
{
    float Rt = 16383*Rf/Vin - Rf;
    float R_ratio = Rt / R_ref;
    float log_ratio = log(R_ratio);
    float inv_temp = (1/T_ref) + (1/B) * log_ratio;
    float T = (1/inv_temp) - 273.15;  // convert to degrees Celsius
    return T;
}

long a0 = 0; //running sum
long a1 = 0; //running sum
long a2 = 0; //running sum
long a3 = 0; //running sum
long samps = 0;
long sample_period = 1000000;

void loop()
{

  a0 += analogRead(A0); //read
  a1 += analogRead(A1); //read
  a2 += analogRead(A2); //read
  a3 += analogRead(A3); //read
  samps++; //increment OS
  int last_marker = 0;
  if (( micros() - last) > sample_period)
  {
    last_marker = micros() - last; //mark time since last send started
    last = micros();

    a0 = a0 / samps; //average readings
    a1 = a1 / samps; //average readings
    a2 = a2 / samps; //average readings
    a3 = a3 / samps; //average readings

    out["a0"] = a0;
    out["a1"] = a1;
    out["T0"] = Tt(a0);
    out["T1"] = Tt(a1);
    // out["T2"] = Tt(a2);
    // out["T3"] = Tt(a3);
    out["ttp"] = micros() - last;
    out["samps"] = last_marker;
    serializeJson(out, Serial);
    Serial.println();

    a0 = 0;
    a1 = 0;
    a2 = 0;
    samps = 0;
    a3 = 0;


  }



}
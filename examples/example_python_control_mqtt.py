import paho.mqtt.client as mqtt
import json

client = mqtt.Client()
client.connect("your.server.here", 1883, 60)
foo = {'setpoint':0,'experiment':'mqtt_start_01','save':True}
client.publish("topic/cmd",json.dumps(foo))
client.disconnect() 
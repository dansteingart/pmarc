import paho.mqtt.client as mqtt
import json

node = "NODE NAME"
mqtta = "some.mqtt.server"
topic = f"pmarc_server/{node}/cmd"
client = mqtt.Client()

client.connect(mqtta, 1883, 60)

foo = {'setpoint':50,'experiment':'mqtt_test_03','save':True} #standard control settings
foo['settings'] = {'setpid':True,"kp":10,"ki":0.05,"kd":0} #if you want to futz with PID coefficients
client.publish(topic,json.dumps(foo))
client.disconnect() 
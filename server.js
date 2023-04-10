var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var fs = require('fs');
var cors = require('cors')
const server = require('http').createServer(app);
var io = require('socket.io')(server,{cors:{methods: ["GET", "POST"]}});
const mqtt = require('mqtt')
var ioc = require('socket.io-client');

//set up express
app.use(cors())
app.use('/static',express.static('static'))
app.use('/files',express.static('files'))
app.use(bodyParser.urlencoded({extended:true})); //deprecated not sure what to do here....
app.use(bodyParser.json())

settings = JSON.parse(fs.readFileSync("settings.json"))
heater = settings['heater'];
thermistors = settings['thermistors']
unit = settings['unit']
socketh = ioc(`ws://localhost:${heater}`)
sockett = ioc(`ws://localhost:${thermistors}`)

//globals
console.log(settings)
var topic = settings['basetopic'];
var save = false;
var unit = settings["unit"];
var experiment = "";
var sdata = {}

//data gets
const regex = /[-+]?[0-9]*\.?[0-9]+/g;

socketh.on("data",(data)=>{
    hparts = data.match(regex);
    if (hparts == null) hparts = []
    if (hparts.length == 3)
    {
        sdata['T_act'] = parseFloat(hparts[0]);
        sdata['T_set'] = parseFloat(hparts[1]);
        sdata['fresh'] = true;
    }
})

buff = ""


sockett.on("data",(data)=>{
    buff += data;
    if (buff.search("\n") > -1)
    {
        out = {}
        try { 
            Ts = JSON.parse(buff);
            sdata['a0'] = Ts['a0'];
            sdata['a1'] = Ts['a1'];
            sdata['T0'] = Ts['T0'];
            sdata['T1'] = Ts['T1'];
        }

        catch(e) {a = 3}
        buff = "";
    }
    
});


//Helper functions
function saver(savestate){ save = savestate; sdata['save'] = savestate; return {'savestatus':savestate}}
function settemp(s){socketh.emit("input",`M104 S${s}`)}
function setinterval(s){socketh.emit("input",`M155 S${s}`)}
function sendgcode(ss){socketh.emit("input",ss)}

//Save to steingart_lab/data on/off
app.get('/save/on', function(req,res){res.send(JSON.stringify(saver(true)))});
app.get('/save/off',function(req,res){res.send(JSON.stringify(saver(false)))});

//Change Experiment Name
app.get('/experiment/*',function(req,res){ 
    experiment = req.originalUrl.replace("/experiment/","")
	experiment = decodeURIComponent(experiment);
    res.send(JSON.stringify({'status':'changed experiment name','experiment':experiment}));
});

//Change hotend setpoint
app.get('/setpoint/*',function(req,res){ 
    setpoint = req.originalUrl.replace("/setpoint/","")
	setpoint = decodeURIComponent(setpoint);
    settemp(setpoint)
    res.send(JSON.stringify({'status':'changed setpoint','setpoint':parseFloat(setpoint)}));
});

//Set Temperature Report Interval
app.get('/interval/*',function(req,res){ 
    interval = req.originalUrl.replace("/interval/","")
	interval = decodeURIComponent(interval);
    setinterval(interval);
    res.send(JSON.stringify({'status':'changed setpoint','setpoint':parseFloat(interval)}));
});


//Send Whatever Gcode to Marlin
app.get('/gcode/*',function(req,res){ 
    gcode = req.originalUrl.replace("/gcode/","")
	gcode = decodeURIComponent(gcode);
    sendgcode(gcode)
    res.send(JSON.stringify({'status':'issued gcode command','command':gcode}));
});

//Homepage
app.get('/',function(req,res){	res.sendFile(__dirname+"/index.html")});

//Return the current measurement
app.get('/state',function(req,res){	res.send(JSON.stringify(sdata))});

//Return the unit/experiment name
app.get('/meta',function(req,res){res.send(JSON.stringify({'unit':unit,'experiment':experiment}))});

//server on!
server.listen(settings['port']);

//mqtt stuff
const client  = mqtt.connect(`mqtt://${settings['mqtt']}`)

//start sending state on connect
client.on('connect',()=>
    {
        client.subscribe(`${unit}/cmd`,()=>{});

        setInterval(()=>{
            if (sdata['fresh'])
            {
                io.emit('data',sdata)
                client.publish(`${unit}/update`, JSON.stringify(sdata));
                if (save) client.publish(`${topic}/${unit}/${experiment}/table`, JSON.stringify(sdata));
                sdata['fresh'] = false;
            }
        }, 1000)
    }
)

//act on messages
client.on('message', 
    function (topic, message) {
        try {
            msg = JSON.parse(message.toString())

            if ("setpoint" in msg) settemp(msg['setpoint']);
            if ("save" in msg) saver(msg['save']);
            if ("experiment" in msg) experiment = msg['experiment'];
            if ("gcode" in msg) sendgcode(msg['gcode']);

            client.publish(`${unit}/confirm`,message.toString());
                
        }
        catch (e){console.log(e)}
    })

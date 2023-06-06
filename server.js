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
ramps = settings['ramps'];
unit = settings['unit']
socketr = ioc(`ws://localhost:${ramps}`)
console.log(socketr.connected)
//globals
console.log(settings)
var topic = settings['basetopic'];
var save = false;
var unit = settings["unit"];
var experiment = "";
var sdata = {}

//data gets
const regex = /[-+]?[0-9]*\.?[0-9]+/g;

buff = ""
socketr.on("data",(data)=>{
    buff += data;
    if (buff.search("\n") > -1)
    {
        out = {}
        try { 
            Ts = JSON.parse(buff);
            for(var k in Ts) sdata[k]=Ts[k];
        }
        catch(e) {a = 3}
        sdata['fresh'] = true;
        buff = "";
    }
});


//Helper functions
function saver(savestate){ save = savestate; sdata['save'] = savestate; return {'savestatus':savestate}}
function settemp(s){socketr.emit("input",JSON.stringify({'setpoint':s}))};
function sendramps(ss){socketr.emit("input",JSON.stringify(ss))}


//pithy hack
app.get('/script',function(req,res){res.sendFile(__dirname+"/pindex.html")});

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
    res.send(JSON.stringify({'status':'changed in','interval':parseFloat(interval)}));
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
            console.log(msg)
            if ("setpoint" in msg) settemp(msg['setpoint']);
            if ("save" in msg) saver(msg['save']);
            if ("experiment" in msg) experiment = msg['experiment'];
            if ("settings" in msg) sendramps(msg['settings']);
            client.publish(`${unit}/confirm`,message.toString());
                
        }
        catch (e){console.log(e)}
    })

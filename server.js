var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var fs = require('fs');
var cors = require('cors')
const server = require('http').createServer(app);
var io = require('socket.io')(server,{cors:{methods: ["GET", "POST"]}});
const mqtt = require('mqtt')

//set up express
app.use(cors())
app.use('/static',express.static('static'))
app.use('/files',express.static('files'))
app.use(bodyParser.urlencoded({extended:true})); //deprecated not sure what to do here....
app.use(bodyParser.json())

settings = JSON.parse(fs.readFileSync("settings.json"))
//globals
console.log(settings)
var topic = settings['basetopic'];
var save = false;
var experiment = "";
var savestates = {}
var experiments = {}
//data gets
const regex = /[-+]?[0-9]*\.?[0-9]+/g;

//Helper functions
function saver(node,savestate){ savestates[node] = savestate; return {'savestatus':savestates}}
function settemp(node,s){client.publish(`${node}/cmd`,JSON.stringify({'setpoint':s}))};
function setpid(node,kp,ki,kd){client.publish(`${node}/cmd`,JSON.stringify({'setpid':'true','kp':kp,'ki':ki,'kd':kd}))};

//pithy hack
app.get('/*/script',function(req,res){res.sendFile(__dirname+"/pindex.html")});

//Save to steingart_lab/data on/off
app.get('/*/save/on', function(req,res){node = req.path.split("/")[1],res.send(saver(node,true))});
app.get('/*/save/off',function(req,res){node = req.path.split("/")[1],res.send(saver(node,false))});

//Change Experiment Name
app.get('/*/experiment/*',function(req,res){ 
    parts = req.path.split("/");
    node = parts[1];
    experiment = parts[3];
    experiment = decodeURIComponent(experiment);
    experiments[node] = experiment;
    res.send(JSON.stringify({'status':'changed experiment name','node':node,'experiment':experiment}));
    console.log(experiments);
});

//Change hotend setpoint
app.get('/*/setpoint/*',function(req,res){ 
    parts = req.path.split("/");
    node = parts[1];
    setpoint = parts[3];
    setpoint = decodeURIComponent(setpoint);
    setpoint = parseFloat(setpoint)
    settemp(node,setpoint)
    res.send(JSON.stringify({'status':'changed setpoint','setpoint':setpoint}));
});

//change PID parameters
app.get('/*/setpid/*',function(req,res){ 
    parts = req.path.split("/");
    node = parts[1];
    kp = parseFloat(parts[3]);
    ki = parseFloat(parts[4]);
    kd = parseFloat(parts[5]);
    setpid(node,kp,ki,kd)
    res.send(JSON.stringify({'status':'changed pids','kp':kp,'ki':ki,'kd':kd}));
});


//Return the current measurement
//app.get('/state',function(req,res){	res.send(JSON.stringify(s))});

//Return the experiment names
app.get('*/meta',function(req,res){res.send(JSON.stringify({'experiment':experiments}))});

//Homepage
app.get('/*',function(req,res){	res.sendFile(__dirname+"/index.html")});


//server on!
server.listen(settings['port']);

//mqtt stuff
const client  = mqtt.connect(`mqtt://${settings['mqtt']}`)

//start sending state on connect
client.on('connect',()=>
    {
        console.log("connecting yo")
        client.subscribe(`pmarc_server/cmd`,()=>{});
        client.subscribe(`+/update`,()=>{});
    }
)

//act on messages
client.on('message', 
    function (topic, message) {
        //sort logic
        if ((topic.search("update") > -1) & (topic.search("_pi") == -1))
        {
            try
            {
            node = topic.split("/")[0];
            msg = JSON.parse(message.toString());
            if (savestates[node]) client.publish(`${settings['basetopic']}/${node}/${experiments[node]}/table`,JSON.stringify(msg));            
            if (experiments[node] != undefined) msg['experiment'] = experiments[node];
            if (savestates[node] != undefined) msg['save'] = savestates[node];
            io.emit(`${node}_data`,msg);
            }
            catch (e){console.log(e)}
        }

        if (topic.search("cmd") > -1)
        {
            try {
                msg = JSON.parse(message.toString())
                console.log(msg)
                if ("setpoint" in msg) settemp(msg['setpoint']);
                if ("save" in msg) saver(msg['save']);
                if ("experiment" in msg) experiment = msg['experiment'];
                if ("settings" in msg) sendramps(msg['settings']);
                client.publish(`pmarcs/confirm`,message.toString());
                    
            }

            catch (e){console.log(e)}
            }
    })

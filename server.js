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
socketh = ioc(`ws://localhost:${heater}`)

//globals
console.log(settings)
var topic = settings['basetopic'];
var publish = false;
var unit = settings["unit"];
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
        console.log(sdata);
    }
})



//express hooks
app.get('/start', function(req,res){ publish = true; res.send(JSON.stringify({'status':'start'}))});
app.get('/stop',  function(req,res){ publish = false;res.send(JSON.stringify({'status':'stop'}))});
app.get('/experiment/*',function(req,res){ 
    experiment = req.originalUrl.replace("/experiment/","")
	experiment = decodeURIComponent(experiment);
    res.send(JSON.stringify({'status':'changed experiment name','experiment':experiment}));
});
app.get('/heater/*',function(req,res){ 
    heater = req.originalUrl.replace("/heater/","")
	heater = decodeURIComponent(heater);
    socketh.emit("input",heater)
    res.send(JSON.stringify({'status':'issued heater command','command':heater}));
});

app.get('/*',function(req,res){	 res.send("Hello World") });

server.listen(settings['port']);

//mqtt out
const client  = mqtt.connect(`mqtt://${settings['mqtt']}`)
client.on('connect',()=>
    {
        setInterval(()=>{
            if (publish & sdata['T_act'] != undefined) 
            {
                client.publish(client.publish(`${topic}/${unit}/${experiment}/table`, JSON.stringify(sdata)));
                sdata['T_act'] = undefined;
            }
        }, 1000)
    }
)

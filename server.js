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
        sdata['fresh'] = true;
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

app.get('/setpoint/*',function(req,res){ 
    setpoint = req.originalUrl.replace("/setpoint/","")
	setpoint = decodeURIComponent(setpoint);
    socketh.emit("input",`M104 S${setpoint}`)
    res.send(JSON.stringify({'status':'changed setpoint','setpoint':parseFloat(setpoint)}));
});

app.get('/interval/*',function(req,res){ 
    interval = req.originalUrl.replace("/interval/","")
	interval = decodeURIComponent(interval);
    socketh.emit("input",`M155 S${interval}`)
    res.send(JSON.stringify({'status':'changed setpoint','setpoint':parseFloat(interval)}));
});


app.get('/tina/*',function(req,res){ 
    tina = req.originalUrl.replace("/tina/","")
	tina = decodeURIComponent(tina);
    socketh.emit("input",tina)
    res.send(JSON.stringify({'status':'issued tina command','command':tina}));
});

app.get('/*',function(req,res){	res.send(JSON.stringify(sdata))});

server.listen(settings['port']);

//mqtt out
const client  = mqtt.connect(`mqtt://${settings['mqtt']}`)
client.on('connect',()=>
    {
        setInterval(()=>{
            if (publish & sdata['fresh']) 
            {
                client.publish(client.publish(`${topic}/${unit}/${experiment}/table`, JSON.stringify(sdata)));
                io.emit('data',sdata)
                sdata['fresh'] = false;
            }
        }, 1000)
    }
)

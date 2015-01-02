
//Declaration of Variables______________________________________________________
var fs = require('fs');
var http = require('http');
var socketio = require('socket.io');

var gameRunning = false;

var usersRegistered = new Array();
var actors = new Array();

var tiles = new Array();
var tileSize = 60;

var changelist = new Array();


//Create HTTP Server____________________________________________________________
var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    res.end(fs.readFileSync(__dirname + '/index.html'));
}).listen(8080, function() {
    console.log('Listening at: http://localhost:8080');
});


//User connects_________________________________________________________________
socketio.listen(server).on('connection', function (socket) 
{
  //User logs in________________________________________________________________
  socket.on('login', function (msg) 
  {
    console.log('Login: ', msg);
    
    //Loop through uesrsRegistered, might be replaced by a database authentification, so that a server has not to have the full list of users
    for(var n=0; n<usersRegistered.length; n++)
    {
      if(msg == usersRegistered[n].name && usersRegistered[n].socket == null && !socket.hasOwnProperty('user'))
      {
        console.log('Success: ', msg);
        socket.user = usersRegistered[n];
        socket.user.socket = socket;
 
        socket.emit('loginSuccess');
        socket.emit('update', getMapJSON() );

 
        socket.user.alive = true;
        changelist.push({name:actors[n].name, type:'actor', x:actors[n].pos.x, y:actors[n].pos.y, width:actors[n].width, height:actors[n].height });
        msg = null;
      }
    }
    
    if (msg != null)
    {
      socket.emit('loginFail', msg);
    }
  });

  //User logs out_______________________________________________________________
  socket.on('disconnect', function (data) 
  {
    if( socket.hasOwnProperty('user') )
    {
      socket.user.alive = false;
      changelist.push({name:socket.user.name, type:'kill' });
      socket.user.socket = null;
    }
  });    
  
  //User sends left Click____________________________________________________________
  socket.on('leftclick', function (data) 
  {
    if( socket.hasOwnProperty('user') )
    {
      socket.user.target.x = parseInt(data.x);
      socket.user.target.y = parseInt(data.y);
      //socket.emit('message',socket.user.target.x+' '+socket.user.target.y);
    }
  });

  //User sends right Click____________________________________________________________
  socket.on('rightclick', function (data)
  {
    if( socket.hasOwnProperty('user') )
    {
      changelist.push({name:'x', type:'actor', x:socket.user.pos.x, y:socket.user.pos.y, width:10, height:10 });
      actors.push(createProjectile("x", socket.user.pos.x, socket.user.pos.y, parseInt(data.x), parseInt(data.y)));
 
      //socket.user.target.x = parseInt(data.x);
      //socket.user.target.y = parseInt(data.y);
      //socket.emit('message',socket.user.target.x+' '+socket.user.target.y);
    }
  });

});


//Class: User___________________________________________________________________
function createActor(posX,posY)
{
  var tmpObject = new Object();
  tmpObject.pos = new Object();
  tmpObject.target = new Object();

  tmpObject.moveSpeed = 80;

  tmpObject.mapIndex = 0;
  tmpObject.pos.x = posX;
  tmpObject.pos.y = posY;
  tmpObject.target.x = posX;
  tmpObject.target.y = posY;
  tmpObject.width = 20;
  tmpObject.height = 20;
  tmpObject.moveX = 0;
  tmpObject.moveY = 0;
  tmpObject.alive = true;
  
  tmpObject.socket = null;
  
  return tmpObject;
}

function createUser(name,pass,posX,posY)
{
  var tmpObject = createActor(posX,posY);
  tmpObject.name = name;
  tmpObject.pass = pass;
  tmpObject.type = "player";
  
  tmpObject.socket = null;
  tmpObject.alive = false;
  
  return tmpObject;
}

function createProjectile(name,posX,posY,targetX,targetY)
{
  var tmpObject = createActor(posX,posY);
  tmpObject.name = name;
  tmpObject.target.x = targetX;
  tmpObject.target.y = targetY;
  tmpObject.width = 10;
  tmpObject.height = 10;
  
  tmpObject.type = "projectile";
  
  return tmpObject;
}

function createAI(name,posX,posY)
{
  var tmpObject = createActor(posX,posY);
  tmpObject.name = name;
  tmpObject.type = "AI";
  
  tmpObject.AItick = function()
  {
    //put AI inteligence here
    
    if(this.pos.x < 100)
    {
      this.target.x = 500;
    }
    else if(this.pos.x > 400)
    {
      this.target.x = 50;
    }
  }
  
  tmpObject.socket = null;
  
  return tmpObject;
}

//Game Tick_____________________________________________________________________
function gametick()
{
  for(var n=0; n < actors.length; n++)
  {
    if(actors[n].alive != false)
    {
      if(actors[n].type == "AI")
      {
        actors[n].AItick();
      }
      
      //put this in actor tick ??
      if(actors[n].pos.x != actors[n].target.x || actors[n].pos.y != actors[n].target.y )
      {
        //actors[n].pos.x 
        var moveX = Math.max(actors[n].moveSpeed*-1, Math.min(actors[n].moveSpeed, actors[n].target.x-actors[n].pos.x));
        //actors[n].pos.y
        var moveY = Math.max(actors[n].moveSpeed*-1, Math.min(actors[n].moveSpeed, actors[n].target.y-actors[n].pos.y));
        
        var addHeight = 0; if(moveY > 0){addHeight = actors[n].height -1}
        var addWidth = 0; if(moveX > 0) {addWidth  = actors[n].width  -1}
        if(tiles[parseInt(Math.max(0,(actors[n].pos.x + moveX + addWidth)/tileSize))][parseInt(Math.max(0,(actors[n].pos.y + moveY + addHeight)/tileSize))] == false )
        {
          actors[n].pos.x += moveX;
          actors[n].pos.y += moveY; 
        }
        else
        {
          actors[n].target.x = actors[n].pos.x;
          actors[n].target.y = actors[n].pos.y;
        }
        
        if(usersRegistered.length > 0)
        {
          changelist.push({name:actors[n].name, type:'update', x:actors[n].pos.x, y:actors[n].pos.y});
        }
      }
    }
  }
  
  
  for(var n=0; n < usersRegistered.length; n++)
  {
    if(usersRegistered[n].socket != null)
    {
      if(changelist.length > 0)
      {
        usersRegistered[n].socket.emit('update',changelist);
        //console.log(changelist);
      }
    }
  }
  
  changelist = new Array();
}

function getMapJSON()
{
  var tmpMap = new Array();
  
  for(var n=0; n < actors.length; n++)
  {
    if(actors[n].alive != false)
    {
      tmpMap.push({name:actors[n].name, type:'actor', x:actors[n].pos.x, y:actors[n].pos.y, width:actors[n].width, height:actors[n].height });
    }
  }
  
  for(var i=0; i<tiles.length;i++)
  {
    for(var j=0; j<tiles.length;j++)
    {
      if(tiles[i][j] == true)
      {
        tmpMap.push({name:'_tile', type:'block', x: (i*tileSize), y: (j*tileSize), tileSize: tileSize, color:'#AAAAAA' } );
      }
    }  
  }
      
  
  
  return tmpMap;
}


//Game Init_____________________________________________________________________
function init()
{
  //create map & players / later load from database
  usersRegistered.push(createUser("a","a",100,200));
  usersRegistered.push(createUser("b","b",100,70));

  actors.push(usersRegistered[0]);
  actors.push(usersRegistered[1]);
  
  actors.push(createAI("AI001",90,150));
  
  tiles.push(new Array(true, true ,true ,true ,true ,true ,true ,true ,true ,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true,false,false,false,false,false,false,false,false,true));
  tiles.push(new Array(true, true ,true ,true ,true ,true ,true ,true ,true ,true));
  
  
  GameRunning = true;
  setInterval(gametick,500);
  //to delete the times, save timer ID to variable :: clearInterval(intervalId)
}

init();

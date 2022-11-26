const express = require("express");
const { createServer } = require("http");
const WebSocket = require("ws");
const mysql = require("mysql2");
const Context = require("@longanphuc/orm-mysql").Context;
const Player = require("./Model/player_player");
const Game = require("./Model/game_game");
const GameInfo = require("./Model/game_gameinfo");
const Account = require("./Model/account_account");
const Connection = require("@longanphuc/orm-mysql/connection");
const { v1: uuidv1, v4: uuidv4 } = require("uuid");
const axios = require('axios');
const key ="SqgfZ1SE4v3OKlWezV1ft3PrP3O17zi0pEU2O1FcRQORp5YUjv"
const URL = process.platform == "win32"?"http://127.0.0.1:8000/" :"https://api.soccerlegend.devmini.com/"


const app = express();
const port = process.env.PORT || 3000;;

app.get("/", (req, res) => {
  res.send("<h1>Hello world v: 26-11-2022 01:39</h1>");
});

const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.sendRoom = (roomID, data) => {
  wss.clients.forEach((client) => {
    if (client.roomID == roomID) {
      client.send(data);
    }
  });
};

wss.on("connection", function (ws, req) {
  console.log("client joined.");
  ws.id = uuidv4();
  console.log(ws.id);
  ws.send("v: 26-11-2022 01:39");
  ws.on("message", function (data) {
    try {
      console.log(data);
      console.log(ws._token);
      obj = JSON.parse(data);
      if (obj.type)
        if (ws[obj.type]) {
          ws[obj.type](obj.data);
        }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  });

  ws.login = async (data) => {
    try {
      let account_context = new Context(Account);
      let account = await account_context.where("_token", data).first();
      if (account !== undefined) {
        ws.account = account.toObject();
        wss.clients.forEach((client) => {
          if (client.account.id == ws.account.id && client.id != ws.id) {
            client.send(
              JSON.stringify({
                type: "login",
                data: "",
              })
            );
          }
        });
      }
    } catch (err) {
      ws.send("error: " + err.message);
    }
  };

  ws.createRoom = async (data) => {
    try{
      console.log("createRoom");
      console.log(ws.account);
      if (ws.account._token == data._token) {
        ws.roomID = data.roomID;
        ws.clientID = data.clientID;
        ws.IsMaster = true;
        ws.send(
          JSON.stringify({
            type: "onServerCreateRoom",
            data: "Success",
          })
        );
      } else {
        ws.send({
          type: "onServerCreateRoom",
          data: "Fail",
        });
      }
    }catch(err){
      ws.send("error: " + err.message);
    }
  };

  ws.joinRoom = (data) => {
    try{
      console.log("joinRoom");
      if (ws.account._token == data._token) {
        ws.roomID = data.roomID;
        ws.clientID = data.clientID;
        ws.send(
          JSON.stringify({
            type: "onServerCreateRoom",
            data: "Success",
          })
        );
      } else {
        ws.send({
          type: "onServerCreateRoom",
          data: "Fail",
        });
      }
    }catch(err){
      ws.send("error: " + err.message);
    }
  };

  ws.onGameBeginStart = (data) => {
    try{
      console.log("onGameBeginStart");
      if (ws.IsMaster) {
        let playerList = [];
        wss.clients.forEach((client) => {
          if (client.roomID == ws.roomID) {
            playerList.push(client);
          }
        });
        playerList = shuffle(playerList);
        let MaxPlayer = playerList.length;
        let playerTeam = [];
        playerList.forEach((client, i) => {
          if (i < MaxPlayer / 2) {
            client.team = {
              UserID: client.clientID,
              team: 0,
              position: i,
              account_id: client.account.id,
            };
          } else {
            client.team = {
              UserID: client.clientID,
              team: 1,
              position: i - MaxPlayer / 2,
              account_id: client.account.id,
            };
          }
          playerTeam.push(client.team);
        });
  
        wss.sendRoom(
          ws.roomID,
          JSON.stringify({
            type: "receiveTeamFromSever",
            data: JSON.stringify({ Items: playerTeam }),
          })
        );
      }
    }catch(err){
      ws.send("error: " + err.message);
    }
  };

  ws.disconnectPhoton = (data) => {
    try{
      console.log("disconnectPhoton");
      roomID = ws.roomID;
      ws.roomID = undefined;
      ws.clientID = undefined;
      if (ws.IsMaster) {
        ws.setNewMastser(roomID);
      }
    }catch(err){
      ws.send("error: " + err.message);
    }
  };

  ws.setNewMastser = (roomID) => {
    try{
      let playerList = [];
      wss.clients.forEach((client) => {
        if (client.roomID == roomID) {
          playerList.push(client);
        }
      });
      if (playerList.length > 0) {
        let rd = Math.floor(Math.random() * playerList.length);
        let client = playerList[rd];
        client.IsMaster = true;
        ws.IsMaster = undefined;
        wss.sendRoom(
          roomID,
          JSON.stringify({
            type: "setNewMaster",
            data: client.clientID,
          })
        );
      }
    }catch(err){
      ws.send("error: " + err.message);
    }
  };

  ws.sendResult = async (data) => {
    try{
      console.log("sendResult")
      redScore = data.redScore;
      blueScore = data.blueScore;
      if (ws.IsMaster) {
        let playerTeam = []
        wss.clients.forEach(client => {
          if (client.roomID == ws.roomID){
            playerTeam.push(client.team)
          }
        })
        let data = {
          key: key,
          redScore: redScore,
          blueScore: blueScore,
          playerTeam: playerTeam,
          master: ws.account.id
        }
        console.log(URL + "game/send-game-results")
        axios.post(URL + "game/send-game-results", data).then((response) => {
          console.log(response)
          wss.clients.forEach(async client => {
            let player_context = new Context(Player)
            let player = await player_context.find(ws.account.id)
            client.send(
              JSON.stringify({
                type: "endGame",
                data: JSON.stringify({
                  player: JSON.stringify(player.toObject()),
                  gameID: response.data.gameID,
                }),
              })
            );
          })
        }).catch(function (error) {
          console.log(error);
        })    
      }
    }catch(err){
      ws.send("error: " + err.message);
    }
  };

  ws.on("close", function () {
    console.log("client left.");
    if (ws.IsMaster) {
      ws.setNewMastser(ws.roomID);
    }
  });
});

server.listen(port, function () {
  console.log(`Listening on http://localhost:${port}`);
});

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

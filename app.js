const express = require('express')
const http = require('http')
const app = express()
const server = http.Server(app)

const io = require('socket.io').listen(server)

const numberOfPlayers = 2
const numberOfQuestions = 2

io.on('connection', onConnect)


let channels = []


function onConnect(socket) {
   let clientData = {
      name: String,
      channel: String,
      index: Number,
      isModerator: Boolean
   }
   socket.leave(Object.keys(io.sockets.adapter.rooms)[Object.keys(io.sockets.adapter.rooms).length - 1])
   socket.emit('succes', "You have been connected.")
   socket.on('join', (clientName) => {
      clientData.name = clientName
      handleName(clientName, socket)
      socket.on('subscribe', (channel) => {
         clientData.channel = channel
         handleSubscribersAndChannel(clientData, socket) 
         socket.emit('joinSucces', createWelcomeMessage(clientData))
      })
   })

   socket.on('question', (question, answerString, correctAnswer) => {
      io.sockets.adapter.rooms[clientData.channel].currentAnswer = correctAnswer
      io.sockets.adapter.rooms[clientData.channel].questionCounter++
      socket.to(clientData.channel).emit('question', createQuestionString(question, answerString, clientData))
   })

   socket.on('answer', (guess) => {
      let answer = io.sockets.adapter.rooms[clientData.channel].currentAnswer
      if (guess === answer) {
         io.sockets.adapter.rooms[clientData.channel].subscribers[clientData.index].points++
         socket.emit('correct', io.sockets.adapter.rooms[clientData.channel].subscribers[clientData.index].points)
         io.to(clientData.channel).emit('questionAnswered', clientData.name)
         if (io.sockets.adapter.rooms[clientData.channel].questionCounter >= numberOfQuestions) {
            gameOver(socket, clientData)
            return
         }
         io.sockets.connected[io.sockets.adapter.rooms[clientData.channel].moderatorId].emit('ask again')
      } else {
         socket.emit('wrong')
      }
   })

   socket.on('disconnect', () => {
      console.log(`${clientData.name} disconnected ${clientData.channel}`)
      let index = io.sockets.adapter.rooms[clientData.channel].subscribers.findIndex(sub => {sub.name === clientData.name})
      io.sockets.adapter.rooms[clientData.channel].subscribers.splice(index, 1)
      io.to(clientData.channel).emit('disconnection', clientData.name)
   })
}

server.listen(3000)

console.log('server is listening on port 3000')

function handleSubscribersAndChannel(clientData, socket) {
   socket.join(clientData.channel)
   console.log(`${clientData.name} has joined ${clientData.channel}`)
   socket.to(clientData.channel).emit('join', clientData.name)
   if (io.sockets.adapter.rooms[clientData.channel].subscribers === undefined) {
      io.sockets.adapter.rooms[clientData.channel].subscribers = [{name: clientData.name, isModerator: true}]
      io.sockets.adapter.rooms[clientData.channel].moderatorId = socket.id
      io.sockets.adapter.rooms[clientData.channel].questionCounter = 0
      clientData.isModerator = true
      clientData.index = 0
   } else {
      clientData.index = io.sockets.adapter.rooms[clientData.channel].subscribers.length
      clientData.isModerator = false
      io.sockets.adapter.rooms[clientData.channel].subscribers.push({name: clientData.name, isModerator: false, points: 0})
   }
   subscribers = io.sockets.adapter.rooms[clientData.channel].subscribers
   if (subscribers.length >= numberOfPlayers + 1 ) {
      io.sockets.connected[io.sockets.adapter.rooms[clientData.channel].moderatorId].emit('ready')
   }
}



function handleName(clientName, socket){
   channels = Object.keys(io.sockets.adapter.rooms)
   console.log(`${clientName} has connected`)
   socket.emit('selectChannel', channels)
}

function createWelcomeMessage(clientData) {
   let otherSubscribers = [...io.sockets.adapter.rooms[clientData.channel].subscribers]
   otherSubscribers.splice(-1, 1)
   let moderator = otherSubscribers.find(person => person.isModerator)
   let otherPlayers = otherSubscribers.filter(person => !person.isModerator)

   let otherPlayersString = "" 
   otherPlayers.forEach(player => otherPlayersString += player.name + "\n")
   if (clientData.isModerator) {
      return `Welcome to ${clientData.channel}! \nYou are the moderator, so you get to ask the\nquestions once your friends have joined.\n`
   } else {
      return `Welcome to ${clientData.channel}! \nWhen the moderator asks a question, answer it correctly as fast as possible.\nModerator: ${moderator.name}\nOther players: ${otherPlayersString}`
   }
}

function createQuestionString(question, answerString, clientData) {
   return `Question number: ${io.sockets.adapter.rooms[clientData.channel].questionCounter}\n${question}\n${answerString}`
}

function gameOver(socket, clientData) {
   io.in(clientData.channel).emit('game over')
   io.to(clientData.channel).emit('result', io.sockets.adapter.rooms[clientData.channel].subscribers)
   io.sockets.adapter.rooms[clientData.channel].subscribers.sort((a,b) => { return Number(b.points) - Number(a.points) })
   io.to(clientData.channel).emit('announce winner', io.sockets.adapter.rooms[clientData.channel].subscribers[1])
}
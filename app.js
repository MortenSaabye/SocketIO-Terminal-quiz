const express = require('express')
const http = require('http')
const app = express()
const server = http.Server(app)

const io = require('socket.io').listen(server)

const numberOfPlayers = 2
const numberOfQuestions = 2

io.on('connection', onConnect)


let channels = []
function getChannel(clientData) {
   return io.sockets.adapter.rooms[clientData.channel]
}
function getSocket(clientData) {
   return io.sockets.connected[clientData.socketId]
}

function onConnect(socket) {
   let clientData = socketInit(socket)

   socket.on('join', (name) => onJoin(clientData, name))
   socket.on('subscribe', (channel) => onSubscribe(clientData, channel))
   socket.on('question', (question, answerString, correctAnswer) => onQuestion(clientData, question, answerString, correctAnswer))

   socket.on('answer', (guess) => onAnswer(clientData, guess))

   socket.on('restart', () => {
      subscribeToChannel(clientData)
   })

   socket.on('leaveChannel', () => {
      socket.leave(clientData.channel)
   })

   socket.on('disconnect', () => onDisconnect(clientData))
}

server.listen(3000)

console.log('server is listening on port 3000')

function subscribeToChannel(clientData) {
   console.log(clientData.name)
   channels = Object.keys(io.sockets.adapter.rooms)
   getSocket(clientData).emit('selectChannel', channels)
}

function handleSubscribersAndChannel(clientData) {
   console.log(clientData)
   getSocket(clientData).join(clientData.channel)
   console.log(`${clientData.name} has joined ${clientData.channel}`)
   getSocket(clientData).to(clientData.channel).emit('newPlayer', clientData.name)
   if (getChannel(clientData).subscribers === undefined) {
      getChannel(clientData).subscribers = [{name: clientData.name, isModerator: true}]
      getChannel(clientData).moderatorId = getSocket(clientData).id
      getChannel(clientData).questionCounter = 0
      clientData.isModerator = true
      clientData.index = 0
   } else {
      clientData.index = getChannel(clientData).subscribers.length
      clientData.isModerator = false
      getChannel(clientData).subscribers.push({name: clientData.name, isModerator: false, points: 0})
   }
   if (getChannel(clientData).subscribers.length >= numberOfPlayers + 1 ) {
      io.sockets.connected[getChannel(clientData).moderatorId].emit('ready')
   }
   getSocket(clientData).emit('joinSucces', createWelcomeMessage(clientData))
}

function socketInit(socket) {
   console.log("init function called")
   let clientData = {
      name: String,
      channel: String,
      index: Number,
      isModerator: Boolean,
      socketId: socket.id
   }
   socket.leave(Object.keys(io.sockets.adapter.rooms)[Object.keys(io.sockets.adapter.rooms).length - 1])
   socket.emit('succes', "You have been connected.")
   return clientData
}

function onJoin(clientData, name) {
   clientData.name = name
   console.log(`${name} has connected`)
   subscribeToChannel(clientData)
}

function onSubscribe(clientData, channel) {
   console.log("subscribeToChannel handler called")
   clientData.channel = channel
   handleSubscribersAndChannel(clientData)
}

function createWelcomeMessage(clientData) {
   let otherSubscribers = [...getChannel(clientData).subscribers]
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
   return `Question number: ${getChannel(clientData).questionCounter}\n${question}\n${answerString}`
}

function onQuestion(clientData, question, answerString, correctAnswer) {
   getChannel(clientData).currentAnswer = correctAnswer
   getChannel(clientData).isWaitingForAnswer = true
   getChannel(clientData).questionCounter++
   getSocket(clientData).to(clientData.channel).emit('question', createQuestionString(question, answerString, clientData))
}

function onAnswer(clientData, guess) {
   let answer = getChannel(clientData).currentAnswer
   if (guess === answer) {
      getChannel(clientData).isWaitingForAnswer = false
      getChannel(clientData).subscribers[clientData.index].points++
      getSocket(clientData).emit('correct', getChannel(clientData).subscribers[clientData.index].points)
      io.to(clientData.channel).emit('questionAnswered', clientData.name)
      if (getChannel(clientData).questionCounter >= numberOfQuestions) {
         gameOver(clientData)
         return
      }
      io.to(clientData.channel).emit('next round', getChannel(clientData).moderatorId)
   } else if (getChannel(clientData).isWaitingForAnswer) {
      getSocket(clientData).emit('wrong')
   }
}

function gameOver(clientData) {
   io.to(clientData.channel).emit('game over')
   io.to(clientData.channel).emit('result', getChannel(clientData).subscribers)
   getChannel(clientData).subscribers.sort((a,b) => { return Number(b.points) - Number(a.points) })
   console.log(getChannel(clientData))
   io.to(clientData.channel).emit('announce winner', getChannel(clientData).subscribers[1])
}

function onDisconnect(clientData) {
   if (getChannel(clientData)) {
      console.log(`${clientData.name} disconnected ${clientData.channel}`)
      let index = getChannel(clientData).subscribers.findIndex(sub => { sub.name === clientData.name })
      getChannel(clientData).subscribers.splice(index, 1)
      io.to(clientData.channel).emit('disconnection', clientData.name)
   } else {
      console.log(`${clientData.name} left the game.`)
   }
}
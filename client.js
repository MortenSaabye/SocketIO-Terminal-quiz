const io = require('socket.io-client')
const socket = io('http://localhost:3000')
const readline = require('readline')


const rl = readline.createInterface({
   input: process.stdin,
   output: process.stdout
})



socket.on('succes', (message) => {
   console.log(message)
   rl.question("What is your name? \n", (name) => {
      socket.emit('join', name)
   })
})

socket.on('selectChannel', (channels) => {
   console.log("Available channels: \n")
   if (channels.length != 0) {
      (channels).forEach(channel => {
         console.log(`${channel}`)
      })
   } else {
      console.log("No channels available, create one...")
   }

   rl.question("Pick or create one \n", (channel) => {
      console.log("question callback")
      socket.emit('subscribe', channel)
   })
})

socket.on('joinSucces', (message, index) => {
   console.log(message)
})

socket.on('newPlayer', (name) => {
   console.log(`> ${name} has joined the channel`)
})

socket.on('ready', () => {
   console.log("The game is ready to begin")
   askQuestion()
})

socket.on('next round', (moderatorId) => {
   console.log('Next round')
   if(moderatorId === socket.id) {
      askQuestion()
   }
})

socket.on('question', (question) => {
   console.log(question)
   rl.question("Answer with with a number\n", answer => {
      socket.emit('answer', answer)
   })
})

socket.on('questionAnswered', (name) => {
   rl.write(`${name} was the first player to answer correctly\n`)
})

socket.on('wrong', () => {
   console.log(`Sorry, that is not correct.`)
})

socket.on('correct', points => {
   console.log(`Correct! You have ${points} points.`)
})

socket.on('game over', () => {
   console.log(`Game over!\nScore:`)
})

socket.on('result', (players) => {
   players.forEach(player => {
      if(!player.isModerator) {
         console.log(`${player.name}: ${player.points}`)
      }
   })
})

socket.on('announce winner', (winner) => {
   console.log(`The winner is: ${winner.name}!`)
   socket.emit('leaveChannel')
   rl.question("Do you want to play again? (Y/N)\n", replay => {
      if (replay == "Y") {
         socket.emit('restart')
      } else {
         socket.close()
      }
   })
})

socket.on('disconnection', (name) => {
   console.log(`${name} has disconnected`)
})

function askQuestion() {
   rl.question("Ask a question\n", question => {
      rl.question("Now you need to add four possible answers, of which one is corrent\nSeparate these with a comma.\n", answers => {
         rl.question("Which answer was correct? (Enter the number: 1,2,3,4)\n", correct => {
            socket.emit('question', question, answers, correct)
         })
      })
   })
}
Pusher.logToConsole = true

const bingo = 'BINGO'
let currentGame = null
let gameCount = 0
let pendingCallLetter = 'B'
let pendingCallNumber = null

var audio = new Audio('ding.mp3')

var pusher = new Pusher('01a8dec24c4ede4bd671', {
  cluster: 'us2',
})

var channel = pusher.subscribe('bingo')
channel.bind('call', function (data) {
  setCall(data)
})
channel.bind('load-game', function (data) {
  loadGame(data.game)
})
channel.bind('reload', function () {
  window.location.reload(true)
})

function initBoard() {
  const boardDiv = document.querySelector('div.board')
  for (let i = 0; i < 75; i++) {
    if (i % 15 == 0) {
      const newDiv = document.createElement('div')
      newDiv.textContent = bingo[i / 15]
      newDiv.className = 'header'
      boardDiv.appendChild(newDiv)
    }
    const newDiv = document.createElement('div')
    newDiv.textContent = i + 1
    newDiv.className = 'number'
    newDiv.id = 'number-' + (i + 1)
    boardDiv.appendChild(newDiv)
  }
}

function initCallSelection() {
  const letterSelectionDiv = document.querySelector('div.call-letter-selection')
  for (let i = 0; i < 5; i++) {
    const newButton = document.createElement('button')
    newButton.id = 'call-letter-' + i
    newButton.textContent = bingo[i]
    newButton.onclick = () => {
      selectCallLetter(i)
    }
    letterSelectionDiv.appendChild(newButton)
  }
  selectCallLetter(0)
}

function selectCallLetter(letter) {
  pendingCallLetter = bingo[letter]
  pendingCallNumber = null
  for (let i = 0; i < 5; i++) {
    const button = document.getElementById('call-letter-' + i)
    if (i == letter) {
      button.classList.add('selected-call-button')
    } else {
      button.classList.remove('selected-call-button')
    }
  }
  const letterSelectionDiv = document.querySelector('div.call-number-selection')
  letterSelectionDiv.innerHTML = null
  const start = letter * 15
  for (let i = 0; i < 15; i++) {
    const newButton = document.createElement('button')
    newButton.id = 'call-number-' + (start + i + 1)
    newButton.textContent = start + i + 1
    newButton.onclick = () => {
      selectCallNumber(start + i + 1)
    }
    letterSelectionDiv.appendChild(newButton)
  }
}

function selectCallNumber(number) {
  pendingCallNumber = number
  const start = bingo.indexOf(pendingCallLetter) * 15
  for (let i = 0; i < 15; i++) {
    const button = document.getElementById('call-number-' + (start + i + 1))
    if (start + i + 1 == number) {
      button.classList.add('selected-call-button')
    } else {
      button.classList.remove('selected-call-button')
    }
  }
}

async function makeCall() {
  if (!currentGame || !pendingCallLetter || !pendingCallNumber) {
    return
  }
  await axios.post(`/api/games/${currentGame}/calls`, {
    letter: pendingCallLetter,
    number: pendingCallNumber,
  })
}

function resetGame() {
  const currentCallDiv = document.getElementById('current-call')
  const previousCallDiv = document.getElementById('previous-call')
  const callsListDiv = document.querySelector('div.calls-list')
  currentCallDiv.innerText = '-'
  previousCallDiv.innerText = '-'
  if (callsListDiv) {
    callsListDiv.innerHTML = null
  }
  for (let i = 0; i < 75; i++) {
    removeNumberFromBoard(i + 1)
  }
}

async function loadGame(game) {
  resetGame()
  if (!game) {
    const currentGameResponse = await axios.get('/api/games/current')
    currentGame = currentGameResponse.data.id
  } else {
    currentGame = game
  }
  const currentCallsResponse = await axios.get(
    `/api/games/${currentGame}/calls`,
  )
  currentCallsResponse.data.items.forEach((call) => {
    setCall(call, false)
  })
}

async function newGame() {
  const gameName = `Game ${gameCount + 1}`
  const response = await axios.post(`/api/games`, {
    name: gameName,
  })
  const gamesListDiv = document.querySelector('div.games-list')
  const newButton = document.createElement('button')
  newButton.textContent = gameName
  newButton.onclick = async () => {
    await axios.post('/api/games/current', { game: response.data.id })
  }
  gamesListDiv.appendChild(newButton)
  gameCount += 1
}

async function loadGames() {
  const gamesResponse = await axios.get('/api/games')
  const gamesListDiv = document.querySelector('div.games-list')
  gameCount = gamesResponse.data.items.length
  gamesResponse.data.items.forEach((game) => {
    const newButton = document.createElement('button')
    newButton.textContent = game.name
    newButton.onclick = async () => {
      await axios.post('/api/games/current', { game: game.id })
    }
    gamesListDiv.appendChild(newButton)
  })
}

function setCall(call, playAudio = true) {
  const currentCallDiv = document.getElementById('current-call')
  const previousCallDiv = document.getElementById('previous-call')
  previousCallDiv.innerHTML = currentCallDiv.innerHTML
  currentCallDiv.innerHTML = null
  const span = document.createElement('span')
  span.innerText = call.letter
  currentCallDiv.appendChild(span)
  currentCallDiv.appendChild(document.createTextNode(call.number))
  if (playAudio) {
    if (!audio.paused) {
      audio.pause()
      audio.currentTime = 0
    }
    audio.play()
  }
  addNumberToBoard(call.number)
  addCallToList(call)
}

function addCallToList(call) {
  const callsListDiv = document.querySelector('div.calls-list')
  if (callsListDiv) {
    const newButton = document.createElement('button')
    newButton.textContent = `❌ ${call.letter}${call.number}`
    newButton.onclick = async () => {
      await axios.delete(`/api/games/${currentGame}/calls/${call.id}`)
    }
    callsListDiv.prepend(newButton)
  }
}

function addNumberToBoard(number) {
  const numberDiv = document.getElementById('number-' + number)
  numberDiv.classList.add('number-selected')
}

function removeNumberFromBoard(number) {
  const numberDiv = document.getElementById('number-' + number)
  numberDiv.classList.remove('number-selected')
}

async function reload() {
  await axios.post(`/api/reload`, {})
}

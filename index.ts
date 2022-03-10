import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
import faunadb from 'faunadb'
import Pusher from 'pusher'
import { Router } from 'worktop'
import { getFaunaError } from './utils'

const router = new Router()

let faunaClient: faunadb.Client
let pusher: Pusher

function getFaunaClient() {
  if (!faunaClient) {
    faunaClient = new faunadb.Client({
      secret: (globalThis as any).FAUNA_SECRET,
      domain: 'db.us.fauna.com',
    })
  }

  return faunaClient
}

function getPusher() {
  if (!pusher) {
    pusher = new Pusher({
      appId: '1343402',
      key: '01a8dec24c4ede4bd671',
      secret: (globalThis as any).PUSHER_SECRET,
      cluster: 'us2',
      useTLS: true,
    })
  }

  return pusher
}

const {
  Create,
  Collection,
  Documents,
  Match,
  Index,
  Map,
  Lambda,
  Get,
  Ref,
  Paginate,
  Sum,
  Delete,
  Add,
  Select,
  Let,
  Var,
  Update,
} = faunadb.query

router.add('GET', '/api/test', async (req, res) => {
  res.send(200, { test: 'hello world' })
})

router.add('POST', '/api/reload', async (req, res) => {
  await getPusher().trigger('bingo', 'reload', {})
  res.send(200)
})

router.add('GET', '/api/games/current', async (req, res) => {
  try {
    const result = await getFaunaClient().query(
      Get(Ref(Collection('Apps'), '323352403532316740')),
    )
    res.send(200, {
      id: (result as any).data.currentGame,
    })
  } catch (error) {
    const faunaError = getFaunaError(error)
    res.send(faunaError.status, faunaError)
  }
})

router.add('POST', '/api/games/current', async (req, res) => {
  try {
    const { game } = (await req.body()) as any

    const result = await getFaunaClient().query(
      Update(Ref(Collection('Apps'), '323352403532316740'), {
        data: {
          currentGame: game,
        },
      }),
    )

    await getPusher().trigger('bingo', 'load-game', {
      id: game,
    })

    res.send(200)
  } catch (error) {
    const faunaError = getFaunaError(error)
    res.send(faunaError.status, faunaError)
  }
})

router.add('GET', '/api/games', async (req, res) => {
  try {
    const result = await getFaunaClient().query(
      Map(
        Paginate(Documents(Collection('Games'))),
        Lambda('gameRef', Get(Var('gameRef'))),
      ),
    )
    res.send(200, {
      items: (result as any).data.map((item: any) => {
        return { id: item.ref.id, ...item.data }
      }),
    })
  } catch (error) {
    const faunaError = getFaunaError(error)
    res.send(faunaError.status, faunaError)
  }
})

router.add('POST', '/api/games', async (req, res) => {
  try {
    const { name } = (await req.body()) as any

    const createResult = await getFaunaClient().query(
      Create(Collection('Games'), {
        data: {
          name,
        },
      }),
    )

    const createdGameId = (createResult as any).ref.id

    const result = await getFaunaClient().query(
      Update(Ref(Collection('Apps'), '323352403532316740'), {
        data: {
          currentGame: createdGameId,
        },
      }),
    )

    await getPusher().trigger('bingo', 'load-game', {
      id: createdGameId,
      name,
    })

    res.send(200, {
      id: createdGameId,
    })
  } catch (error) {
    const faunaError = getFaunaError(error)
    res.send(faunaError.status, faunaError)
  }
})

router.add('GET', '/api/games/:game/calls', async (req, res) => {
  try {
    const game = req.params.game
    const result = await getFaunaClient().query(
      Map(
        Paginate(Match(Index('calls_by_game'), game), { size: 100 }),
        Lambda('callRef', Get(Var('callRef'))),
      ),
    )
    res.send(200, {
      items: (result as any).data
        .filter((item: any) => item.data.game === game)
        .map((item: any) => {
          return { id: item.ref.id, ...item.data }
        }),
    })
  } catch (error) {
    const faunaError = getFaunaError(error)
    res.send(faunaError.status, faunaError)
  }
})

router.add('POST', '/api/games/:game/calls', async (req, res) => {
  try {
    const { letter, number } = (await req.body()) as any
    const game = req.params.game

    const result = await getFaunaClient().query(
      Create(Collection('Calls'), {
        data: {
          game,
          letter,
          number,
        },
      }),
    )

    await getPusher().trigger('bingo', 'call', {
      id: (result as any).ref.id,
      game,
      letter,
      number,
    })

    res.send(200, { id: (result as any).ref.id, game, letter, number })
  } catch (error) {
    const faunaError = getFaunaError(error)
    res.send(faunaError.status, faunaError)
  }
})

router.add('DELETE', '/api/games/:game/calls/:call', async (req, res) => {
  try {
    const game = req.params.game
    const call = req.params.call

    const result = await getFaunaClient().query(
      Delete(Ref(Collection('Calls'), call)),
    )

    await getPusher().trigger('bingo', 'load-game', {
      id: game,
    })

    res.send(200)
  } catch (error) {
    const faunaError = getFaunaError(error)
    res.send(faunaError.status, faunaError)
  }
})

addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleEvent(event))
})

async function handleEvent(event: FetchEvent) {
  if (!event.request.url.includes('/api')) {
    try {
      return await getAssetFromKV(event)
    } catch (e) {
      return new Response('An unexpected error occurred', { status: 500 })
    }
  } else {
    return await router.run(event)
  }
}

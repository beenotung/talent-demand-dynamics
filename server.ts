import express from 'express'
import { print } from 'listening-on'
import { db } from './db'
import { env } from './env'
import { readFileSync } from 'fs'
import { find } from 'better-sqlite3-proxy'
import { proxy } from './proxy'
import { loadTemplate } from './prerender'

let app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

let port = env.PORT
app.listen(port, () => {
  print(port)
})

let urls: Record<string, number> = Object.create(null)
let user_agents: Record<string, number> = Object.create(null)

function getUrlId(url: string): number {
  let id = urls[url]
  if (id) return id
  let row = find(proxy.url, { url })
  id = row ? row.id! : proxy.url.push({ url })
  urls[url] = id
  return id
}

function getUserAgentId(user_agent: string): number {
  let id = user_agents[user_agent]
  if (id) return id
  let row = find(proxy.user_agent, { user_agent })
  id = row ? row.id! : proxy.user_agent.push({ user_agent })
  user_agents[user_agent] = id
  return id
}

let page = __filename.endsWith('.ts')
  ? {
      get html(): string {
        return loadTemplate().html
      },
    }
  : {
      html: readFileSync('public/index.html'),
    }

app.get('/', (req, res) => {
  let timestamp = Date.now()
  let url = req.url
  let user_agent = req.headers['user-agent']
  res.end(page.html)
  setTimeout(() => {
    let url_id = getUrlId(url)
    let user_agent_id = user_agent ? getUserAgentId(user_agent) : null
    proxy.request_log.push({ url_id, user_agent_id, timestamp })
  })
})

app.use(express.static('public'))

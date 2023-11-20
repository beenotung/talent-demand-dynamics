import express from 'express'
import { print } from 'listening-on'
import { db } from './db'
import { env } from './env'
import { readFileSync } from 'fs'

let app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

let port = env.PORT
app.listen(port, () => {
  print(port)
})

let select_range = db.prepare(/* sql */ `
select
  min(post_time) as since
, max(post_time) as until
from job
`)

let select_words = db.prepare(/* sql */ `
select
  word
, job_count
, company_count
from word
where is_tech = 1
  and company_count > 0
order by
  company_count desc
, job_count desc
`)

type Data = {
  range: {
    since: string
    until: string
  }
  words: {
    word: string
    job_count: number
    company_count: number
  }[]
}

function getData(): Data {
  let range = select_range.get() as Data['range']
  let words = select_words.all() as Data['words']
  return { range, words }
}

function readTemplate() {
  let html = readFileSync('public/index.html').toString()

  let parts = html.split('{since}')
  let p1 = parts[0]

  parts = parts[1].split('{until}')
  let p2 = parts[0]

  parts = parts[1].split('{tbody}')
  let p3 = parts[0]

  let p4 = parts[1]

  function render(data: Data): string {
    let { range } = data
    let tbody = ''
    for (let word of data.words) {
      tbody += /* html */ `
<tr>
<td><span class="count">${word.job_count}</span><span class="percentage"></span></td>
<td><span class="count">${word.company_count}</span><span class="percentage"></span></td>
<td>${word.word}</td>
</tr>
`
    }
    return `${p1}${range.since}${p2}${range.until}${p3}${tbody}${p4}`
  }
  return { render }
}

let template = readTemplate()

app.get('/', (req, res) => {
  let template = readTemplate()
  let data = getData()
  res.end(template.render(data))
})

app.use(express.static('public'))

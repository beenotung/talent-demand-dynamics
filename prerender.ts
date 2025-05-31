import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { db } from './db'
import { count } from 'better-sqlite3-proxy'
import { proxy } from './proxy'
import { patchPostTime } from './time'

let select_range = db.prepare(/* sql */ `
select
  min(resolved_post_time) as since
, max(resolved_post_time) as until
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
  job_count: number
  company_count: number
}

function getData(): Data {
  let range = select_range.get() as Data['range']
  let words = select_words.all() as Data['words']
  return {
    range,
    words,
    job_count: proxy.job.length,
    company_count: proxy.company.length,
  }
}

export function loadTemplate() {
  let template = readFileSync('template/index.html').toString()

  let parts = [template]

  parts = parts[0].split('{job_count}')
  let p1 = parts[0]

  parts = parts[1].split('{company_count}')
  let p2 = parts[0]

  parts = parts[1].split('{since}')
  let p3 = parts[0]

  parts = parts[1].split('{until}')
  let p4 = parts[0]

  parts = parts[1].split('{tbody}')
  let p5 = parts[0]

  let p6 = parts[1]

  function render(data: Data): string {
    let { range } = data
    let tbody = ''
    for (let word of data.words) {
      tbody += /* html */ `
<tr>
<td><span class="count">${word.job_count}</span><span class="relative"></span></td>
<td><span class="count">${word.company_count}</span><span class="relative"></span></td>
<td>${word.word}</td>
</tr>
`
    }
    return [
      p1,
      data.job_count.toLocaleString(),
      p2,
      data.company_count.toLocaleString(),
      p3,
      range.since,
      p4,
      range.until,
      p5,
      tbody,
      p6,
    ].join('')
  }

  let data = getData()
  let html = render(data)
  return { html }
}

function main() {
  patchPostTime()
  let page = loadTemplate()

  mkdirSync('public', { recursive: true })
  writeFileSync('public/index.html', page.html)
}

if (process.argv[1] == __filename) {
  main()
}

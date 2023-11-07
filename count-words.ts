import { JobDetail, proxy } from './proxy'
import { singular } from 'pluralize'
import { isStopWord } from 'meta-stopwords'
import { filter, find } from 'better-sqlite3-proxy'
import { db } from './db'
import { startTimer } from '@beenotung/tslib/timer'

let select_job_ids = db
  .prepare(
    /* sql */ `
select id from job_detail
where has_count_word = 0
   or has_count_word is null
`,
  )
  .pluck()

let select_tech_words = db
  .prepare(
    /* sql */ `
select word from word
where is_tech = 1
  and (word like '% %' or word like '%.%')
`,
  )
  .pluck()

let analyzeJobDetail = db.transaction(
  (jobDetail: JobDetail, words: Set<string>) => {
    for (let text of words) {
      let word = find(proxy.word, { word: text })
      if (!word) {
        let id = proxy.word.push({
          word: text,
          is_tech: null,
          job_count: 0,
          company_count: 0,
        })
        word = proxy.word[id]
      }
      word.job_count++
      let word_id = word.id!
      let company_id = jobDetail.job!.company_id
      if (company_id) {
        if (!find(proxy.company_word, { company_id, word_id })) {
          proxy.company_word.push({ company_id, word_id })
          word.company_count++
        }
      }
    }
    jobDetail.has_count_word = true
  },
)

let timer = startTimer('scan tech words')
let techWords = select_tech_words.all() as string[]
techWords.sort((a, b) => b.length - a.length)

timer.next('scan job detail')
let job_ids = select_job_ids.all() as number[]

timer.setEstimateProgress(job_ids.length)
for (let job_id of job_ids) {
  timer.tick()
  let jobDetail = proxy.job_detail[job_id]
  let text = jobDetail.description?.text
  if (!text) continue
  text = text.toLowerCase()
  let words = new Set<string>()
  for (let word of techWords) {
    if (text.includes(word)) {
      words.add(word)
      text = text.replaceAll(word, ' ')
    }
  }
  let match = text.match(/(\w+)/g)
  if (match) {
    for (let word of match) {
      if (+word) continue
      if (isStopWord(word)) continue
      // text = singular(text) // skip this transform to preserve the "s" in "js"
      words.add(word)
    }
  }
  analyzeJobDetail(jobDetail, words)
}
timer.end()

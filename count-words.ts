import { JobDetail, proxy } from './proxy'
import { find } from 'better-sqlite3-proxy'
import { db } from './db'
import { startTimer } from '@beenotung/tslib/timer'
import { splitWords } from './word'

let select_job_ids = db
  .prepare(
    /* sql */ `
select id from job_detail
where has_count_word = 0
   or has_count_word is null
`,
  )
  .pluck()

let select_special_tech_words = db
  .prepare(
    /* sql */ `
select word from word
where is_tech = 1
  and (word like '% %' or word like '%.%' or word like '%-%')
`,
  )
  .pluck()

let select_all_tech_words = db
  .prepare(
    /* sql */ `
select word from word
where is_tech = 1
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

export function main() {
  let timer = startTimer('scan tech words')

  let specialTechWords = select_special_tech_words.all() as string[]
  specialTechWords.sort((a, b) => b.length - a.length)

  let allTechWords = select_all_tech_words.all() as string[]

  let specialWords = [...specialTechWords, 'r & d']

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
    for (let word of splitWords(specialWords, allTechWords, text)) {
      words.add(word)
    }
    analyzeJobDetail(jobDetail, words)
  }
  timer.end()
}

if (process.argv[1] === __filename) {
  main()
}

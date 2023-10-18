import { JobDetail, proxy } from './proxy'
import { singular } from 'pluralize'
import { isStopWord } from 'meta-stopwords'
import { filter, find } from 'better-sqlite3-proxy'
import { db } from './db'
import { startTimer } from '@beenotung/tslib/timer'

let analyzeJobDetail = db.transaction(
  (jobDetail: JobDetail, match: RegExpMatchArray) => {
    for (let text of match) {
      if (+text) continue
      if (isStopWord(text)) continue
      text = text.toLowerCase()
      if (isStopWord(text)) continue
      text = singular(text)
      if (isStopWord(text)) continue
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

let timer = startTimer('scan job detail')
let rows = filter(proxy.job_detail, { has_count_word: null })
timer.setEstimateProgress(rows.length)
for (let jobDetail of rows) {
  timer.tick()
  if (jobDetail.has_count_word) continue
  let match = jobDetail.description?.text.match(/(\w+)/g)
  if (!match) continue
  analyzeJobDetail(jobDetail, match)
}
timer.end()

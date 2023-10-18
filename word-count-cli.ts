import { Job, proxy } from './proxy'
import { singular } from 'pluralize'
import { isStopWord } from 'meta-stopwords'
import { writeFileSync } from 'fs'

type Word = {
  text: string
  job_ids: Set<number>
  company_ids: Set<number>
}

let words = new Map<string, Word>()

for (let jobDetail of proxy.job_detail) {
  let match = jobDetail.description?.text.match(/(\w+)/g)
  if (!match) continue
  for (let text of match) {
    if (+text) continue
    if (isStopWord(text)) continue
    text = text.toLowerCase()
    if (isStopWord(text)) continue
    text = singular(text)
    if (isStopWord(text)) continue
    let word = words.get(text)
    if (!word) {
      word = { text, job_ids: new Set(), company_ids: new Set() }
      words.set(text, word)
    }
    word.job_ids.add(jobDetail.id!)
    let company_id = jobDetail.job!.company_id
    if (company_id) word.company_ids.add(company_id)
  }
}

let file = 'words.txt'
let content = `
word, jobs, companies
----,-----,----------
`.trim()
for (let word of Array.from(words.values()).sort(
  (a, b) => a.company_ids.size - b.company_ids.size,
)) {
  console.log(word.text, word.job_ids.size, word.company_ids.size)
  content += `${word.text}, ${word.job_ids.size}, ${word.company_ids.size}\n`
}
writeFileSync(file, content)

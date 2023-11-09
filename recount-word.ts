import { main as countWords } from './count-words'
import { db } from './db'
import { main as importTechWords } from './import-tech-words'

let queries = /* sql */ `
delete from company_word;
delete from word;
update job_detail set has_count_word = 0;
update sqlite_sequence set seq = 0 where name = 'company_word';
update sqlite_sequence set seq = 0 where name = 'word';
`
  .split('\n')
  .map(sql => sql.trim())
  .filter(sql => sql)
  .map(sql => db.prepare(sql))

for (let query of queries) {
  query.run()
}

importTechWords()
countWords()

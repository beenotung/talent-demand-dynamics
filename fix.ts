import { del, filter, find } from 'better-sqlite3-proxy'
import { db } from './db'
import { proxy } from './proxy'

let select_duplicated_company_id = db
  .prepare(
    /* sql */ `
with list as (
  select
    slug, name
  from company
  group by slug, name
  having count(id) > 1
)
select id from company
inner join list on
    list.slug = company.slug
and list.name = company.name
order by id asc
`,
  )
  .pluck()

let update_company_id = db.prepare(/* sql */ `
update job
set company_id = :main_company_id
where company_id = :sub_company_id
`)

function deduplicateCompany() {
  let company_ids = select_duplicated_company_id.all() as number[]
  for (let main_company_id of company_ids) {
    let company = proxy.company[main_company_id]
    if (!company) continue
    for (let row of filter(proxy.company, {
      name: company.name,
      slug: company.slug,
    })) {
      let sub_company_id = row.id!
      if (sub_company_id == main_company_id) continue
      console.log({ main_company_id, sub_company_id })
      for (let row of filter(proxy.company_word, {
        company_id: sub_company_id,
      })) {
        let record = {
          company_id: main_company_id,
          word_id: row.word_id,
        }
        find(proxy.company_word, record) || proxy.company_word.push(record)
        delete proxy.company_word[row.id!]
      }
      update_company_id.run({ main_company_id, sub_company_id })
      delete proxy.company[sub_company_id]
    }
  }
}

deduplicateCompany()

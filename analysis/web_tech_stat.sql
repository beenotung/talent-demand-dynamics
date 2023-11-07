select
  word
, job_count
, company_count
, date(min(job.post_time)) as first_post_date
, date(max(job.post_time)) as last_post_date
from word
inner join company_word on company_word.word_id = word.id
inner join job on job.company_id = company_word.company_id
where is_tech = 1
  and company_count > 0
group by word.id
order by
  company_count desc
, job_count desc
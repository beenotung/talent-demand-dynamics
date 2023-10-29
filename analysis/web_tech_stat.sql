select
  word, job_count, company_count
-- , min(job.post_time) as first_post_time
-- , max(job.post_time) as last_post_time
from word
-- inner join company_word on company_word.word_id = word.id
-- inner join job on job.company_id = company_word.company_id
where word like '%react%'
   or word like '%next%'
   or word like '%angular%'
   or word like '%vue%'
   or word like '%ionic%'
   or word like '%andriod%'
   or word like '%android%'
   or word like 'ios'
   or word like 'java%'
   or word like '%typescript%'
   or word like '%swift%'
   or word like '%flutter%'
   or word like '%dart%'
   or word like '%xamarin%'
   or word like '%remix%'
   or word like '%php%'
   or word like '%ruby%'
   or word like '%python%'
   or word like 'scala'
-- group by word.id
order by company_count desc

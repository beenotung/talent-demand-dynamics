select
  job.id
, job.resolved_post_time
, company.name
, job.title
, content.text
from content
inner join job_detail on job_detail.description_id = content.id
inner join job on job.id = job_detail.id
inner join company on company.id = job.company_id

where text like '%typescript%'
and text not like '%php%'
and text not like '%wordpress%'
and text not like '%python%'
and text not like '%fintech%'
and text not like '%finance%'
and text not like '%healthcare%'
and (text not like '%java%' or text like '%javascript%')
and (title not like '%java%' or title like '%javascript%')
and text not like '%react%'
and text not like '%Flutter%'
and text not like '%GraphQL%'
and text not like '%Crypto%'
and text not like '%MongoDB%'
-- and text not like '%AWS%'
and text not like '%Unity%'
and text not like '%C#%'
-- and title like '%lead%'

order by job.resolved_post_time desc

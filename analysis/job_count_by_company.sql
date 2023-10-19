select
  job.company_id
, count(*) as job_count
from job
where job.company_id is not null
group by job.company_id
order by job_count desc
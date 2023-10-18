select
  job_type_job.job_id
,  'https://hk.jobsdb.com/hk/en/job/' || job.slug  || '-' || job_type_job.job_id as href
, job.title as job_title
, job.company_id
, job.post_time as job_post_time
, job.slug as job_slug
, company.name as company_name
, location.name as location_name
from job_type_job
inner join job on job.id = job_type_job.job_id
inner join job_type on job_type.id = job_type_job.job_type_id
inner join company on company.id = job.company_id
inner join location on location.id = job.location_id
where job_type.slug = 'freelance-employment'

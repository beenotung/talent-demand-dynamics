select job_type.*,
	count(*)
from job_type
	inner join job_type_job on job_type_job.job_type_id = job_type.id
	inner join job on job.id = job_type_job.job_id
group by job_type.id

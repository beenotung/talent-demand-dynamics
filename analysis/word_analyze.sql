select
  company_count
, job_count
, 1.0 * job_count / company_count as rate
, word
from word
where company_count > 5
order by rate desc
;
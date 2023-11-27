select
  count(*) as count
, strftime('%Y', post_time) as year
, strftime('%W', post_time) as week
, min(date(post_time)) as 'since'
, max(date(post_time)) as 'until'
from job
group by strftime('%Y-%W', post_time)
having min(strftime('%w', post_time)) = '0'
   and max(strftime('%w', post_time)) = '6'
order by since asc

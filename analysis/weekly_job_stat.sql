select
  count(*) as count
, strftime('%Y', post_time) || '-' || strftime('%m', post_time) || '-' || strftime('%W', post_time) as year_month_week
from job
group by year_month_week

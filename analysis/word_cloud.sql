-- the word cloud can be generated on https://www.wordclouds.com/
select
  company_count as weight, word
from word
where weight > 5
order by weight desc
;
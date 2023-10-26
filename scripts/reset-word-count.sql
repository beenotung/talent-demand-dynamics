delete from company_word;
delete from word;
update job_detail set has_count_word = 0;
update sqlite_sequence set seq = 0 where name = 'company_word';
update sqlite_sequence set seq = 0 where name = 'word';

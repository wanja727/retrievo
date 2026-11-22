-- 확신도(확실/애매/모름)를 없앤다. 문제를 풀 때마다 고르는 것이 번거로워서다.
-- 답에 붙던 확신도와, 확실했는데 틀린 개념을 다음 날 먼저 묻던 표시를 함께 지운다.
alter table answer_submission drop column confidence;
alter table concept_progress drop column sure_wrong;

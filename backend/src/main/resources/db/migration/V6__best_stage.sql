-- 기억 기록 (ADR-025): 개념마다 지금까지 도달한 가장 높은 단계를 남긴다.
-- stage는 재확인에서 틀리면 한 단계 내려가지만, 사용자에게 보여주는 기록은 줄지 않아야 한다.
-- best_stage: 0 = 배우는 중, 1 = 학습 완료, 2 = 3일 뒤에도 기억, 3 = 7일 뒤에도 기억, 4 = 장기 기억(21일 뒤에도 기억)
alter table concept_progress add column best_stage int not null default 0 check (best_stage between 0 and 4);

-- 이미 있는 행: 지금 단계와, 확인 기록에 남은 가장 높은 단계 가운데 큰 값
update concept_progress p
set best_stage = greatest(
    p.stage,
    coalesce((select max(d.stage_after) from delayed_check d
              where d.user_id = p.user_id and d.concept_id = p.concept_id), 0));

alter table concept_progress add constraint concept_progress_best_not_below_stage check (best_stage >= stage);

comment on column concept_progress.best_stage is '지금까지 도달한 가장 높은 단계. 틀려서 stage가 내려가도 줄지 않는다';

-- 연속 학습과 이번 주 표시: 사용자가 답을 낸 날을 날짜순으로 읽는다
create index idx_answer_submission_user_date on answer_submission (user_id, service_date);

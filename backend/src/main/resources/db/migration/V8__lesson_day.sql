-- 배운 날에 푸는 문제인지 남긴다.
-- 지금까지는 레슨의 판정 문제를 그날 모두 맞혀야 배운 것으로 쳤다. 문제가 많은 레슨은 지쳤다.
-- 핵심 질문을 적은 문제 파일은 핵심 질문마다 첫 문제 하나만 배운 날에 묻고, 나머지는 지연 확인에서 묻는다.
-- 가져올 때마다 다시 정한다 (LessonDaySet). 이미 있는 행은 다음에 가져올 때까지 모두 배운 날 문제로 둔다.
alter table question add column lesson_day boolean not null default true;

comment on column question.lesson_day is '배운 날에 푸는 문제인지. 아니면 지연 확인에서만 묻는다';

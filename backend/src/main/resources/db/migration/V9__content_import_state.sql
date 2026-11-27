-- 마지막으로 문제 파일을 가져온 상태를 남긴다.
-- 서버는 켜질 때마다 문제 파일을 모두 가져왔다. 바뀐 것이 없어도 문제마다 쿼리를 두 번씩 보내서,
-- Cloud Run이 0대에서 켜질 때 첫 요청이 40초쯤 걸렸다.
-- 문제 파일과 서버 빌드가 지난번과 같으면 가져오기를 건너뛴다. 이 표는 한 행만 둔다.
create table content_import_state (
    id          smallint primary key check (id = 1),
    fingerprint text        not null,
    imported_at timestamptz not null
);

comment on table content_import_state is '마지막으로 문제 파일을 가져온 상태. 한 행만 둔다';
comment on column content_import_state.fingerprint is '문제 파일 전체와 서버 빌드 시각의 SHA-256. 같으면 가져오기를 건너뛴다';

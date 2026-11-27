# 운영 배포

요청이 없을 때 비용이 0원에 가깝게 되도록 만든 구성이다.

```
브라우저 ──> Vercel (프론트, Next.js)
               │  /api/**, /oauth2/**, /login/oauth2/** 는 그대로 넘긴다 (브라우저에는 한 도메인)
               ▼
            Cloud Run 서울 (백엔드 retrievo-api, 요청 없으면 0대, 최대 1대)
               │  커넥션 풀러(세션 모드)
               ▼
            Supabase 서울 (Postgres, retrievo 스키마)
```

- **배포 흐름:** main에 백엔드 변경이 들어가면 GitHub Actions(`backend.yml`)가 테스트를 돌린 뒤 배포한다.
  - dev-lessons의 문제 파일을 이미지에 넣는다.
  - Artifact Registry에 이미지를 올린다.
  - Cloud Run에 배포한다.
- **문제 가져오기:** 서버가 시작할 때 문제 파일을 가져온다. 바뀌지 않은 문제는 그대로 둔다. 문제 파일과 서버 빌드가 지난번과 같으면 통째로 건너뛴다(`content_import_state`). 그래서 배포 뒤 첫 시작만 오래 걸리고, 0대에서 다시 켜질 때는 빠르다.
- **콜드 스타트:** 이미지를 만들 때 CDS 파일(`app.jsa`)을 만든다. 로컬(CPU 1개, 512MB)에서 시작 시간이 16.9초에서 약 4초로 줄었다(2026-11-27).
- **깨워 두기:** Cloud Scheduler 작업 `retrievo-keep-warm`(서울, 무료 3개 안)이 한국 시간 6:00~23:50에 10분마다 `/api/lessons`를 부른다. 그 시간대에는 0대로 내려가지 않는다. 프론트도 페이지를 열 때 `/api/me`를 하나 먼저 보내 깨운다(`frontend/src/app/layout.tsx`). GitHub Actions 예약 실행으로 먼저 해 봤지만 한 번도 돌지 않아서(2026-11-27, 같은 보고가 GitHub 커뮤니티에 여럿 있다) 옮겼다.
- **GitHub 인증:** 키 파일 없이 Workload Identity Federation으로 한다. 이 저장소의 main 브랜치에서만 배포할 수 있다.
- **비밀값:** DB 비밀번호와 카카오 Client Secret은 Secret Manager에 둔다. 나머지 설정은 GitHub 저장소 변수로 둔다.

처음 한 번은 아래 순서대로 설정한다. 계정을 만들고 비밀값을 넣는 일은 사람이 직접 한다.

## 1. Supabase (DB)

1. **프로젝트 만들기:** [supabase.com](https://supabase.com)에서 New project를 만든다.
   - Region: **Northeast Asia (Seoul)**
   - Database password는 따로 저장해 둔다. 3단계 Secret Manager에 넣는다.
   - "Enable Data API"를 끈다.
     - 이 앱은 Supabase API를 쓰지 않고, 백엔드가 DB에 직접 접속한다.
     - 앱 테이블은 어차피 API에 나가지 않는 `retrievo` 스키마에 만든다.
     - 그래도 꺼 두면 노출될 길이 아예 없다.
     - 만들 때 이 옵션이 안 보였으면, 나중에 Project Settings → Data API에서 끈다.
2. **접속 정보 확인:** 프로젝트 화면 위의 **Connect** → **Session pooler**에서 접속 정보를 본다.
   - Cloud Run은 IPv4로만 나가고, Supabase 직접 연결은 IPv6라서 풀러를 쓴다.
   - host: 예) `aws-0-ap-northeast-2.pooler.supabase.com`
   - port: `5432`
   - user: `postgres.<프로젝트 ref>`
3. 이 값으로 4단계 GitHub 변수를 만든다.
   - `DATABASE_URL` = `jdbc:postgresql://<host>:5432/postgres?sslmode=require&currentSchema=retrievo`
   - `DATABASE_USERNAME` = `postgres.<프로젝트 ref>`

무료 플랜은 7일 동안 접속이 없으면 프로젝트가 일시 정지된다. 대시보드에서 Restore를 누르면 다시 켜진다.

## 2. Vercel (프론트) — 주소부터 정한다

1. [vercel.com](https://vercel.com)에서 Add New → Project를 열고 `wanja727/retrievo`를 가져온다.
2. **Root Directory**는 `frontend`로 둔다. Framework는 Next.js로 자동으로 잡힌다.
3. **Environment Variables**에 넣는다.
   - `NEXT_PUBLIC_API_MODE` = `http`
   - `RETRIEVO_API_ORIGIN`은 5단계에서 Cloud Run 주소가 나오면 넣는다.
4. Deploy한다. 백엔드가 아직 없어서 화면만 뜬다.
5. 나온 주소를 적어 둔다. 예) `https://retrievo-xxx.vercel.app`
   - 이 주소가 `RETRIEVO_PUBLIC_URL`이 된다.
   - Settings → Domains에서 원하는 `*.vercel.app` 이름으로 바꿀 수 있다.

로그인은 이 운영 주소에서만 된다. 미리보기(Preview) 배포 주소는 카카오에 등록되지 않았기 때문이다.

## 3. Google Cloud (백엔드)

**3-1. 준비**
1. [console.cloud.google.com](https://console.cloud.google.com)에서 새 프로젝트를 만든다.
2. 결제 계정을 연결한다. Cloud Run은 무료 사용량 안에서도 결제 계정이 있어야 한다.
3. **결제 → 예산 및 알림**에서 예산 알림을 만든다. 예) 월 ₩1,000, 50%·100%에서 메일
4. 오른쪽 위 **Cloud Shell**을 연다. 아래 명령을 차례로 붙여 넣는다. 로컬에 gcloud를 설치하지 않아도 된다.

**3-2. 기본 설정과 이미지 저장소**

```bash
PROJECT_ID=<프로젝트 ID>
REGION=asia-northeast3
REPO=wanja727/retrievo
gcloud config set project $PROJECT_ID
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

# 이미지 저장소. 최근 2개만 남겨서 무료 저장 용량(0.5GB) 안에 둔다
gcloud artifacts repositories create retrievo --repository-format=docker --location=$REGION
cat > cleanup.json <<'EOF'
[
  {"name": "keep-recent", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 2}},
  {"name": "delete-rest", "action": {"type": "Delete"}, "condition": {"olderThan": "1d"}}
]
EOF
gcloud artifacts repositories set-cleanup-policies retrievo --location=$REGION \
  --policy=cleanup.json --no-dry-run
```

**3-3. 서비스 계정과 비밀값**

서비스 계정은 두 개를 만든다.
- `retrievo-run`: 서버가 실행될 때 쓰는 계정
- `retrievo-deploy`: GitHub Actions가 배포할 때 쓰는 계정

```bash
gcloud iam service-accounts create retrievo-run --display-name="Retrievo 서버"
gcloud iam service-accounts create retrievo-deploy --display-name="Retrievo 배포 (GitHub Actions)"
RUN_SA=retrievo-run@$PROJECT_ID.iam.gserviceaccount.com
DEPLOY_SA=retrievo-deploy@$PROJECT_ID.iam.gserviceaccount.com
```

비밀값을 넣는다. `read -rs` 줄에서 값을 붙여 넣고 Enter를 누른다. 화면과 명령 기록에 값이 남지 않는다.

```bash
read -rs -p "Supabase DB 비밀번호: " V && printf '%s' "$V" | gcloud secrets create retrievo-db-password --data-file=- && unset V
read -rs -p "카카오 Client Secret: " V && printf '%s' "$V" | gcloud secrets create retrievo-kakao-secret --data-file=- && unset V
```

서버 계정에 비밀값 읽기 권한을 준다.

```bash
for S in retrievo-db-password retrievo-kakao-secret; do
  gcloud secrets add-iam-policy-binding $S \
    --member=serviceAccount:$RUN_SA --role=roles/secretmanager.secretAccessor
done
```

배포 계정에 권한을 준다.
- Cloud Run 배포
- 이미지 올리기
- 서버 계정으로 실행하기

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$DEPLOY_SA --role=roles/run.admin
gcloud artifacts repositories add-iam-policy-binding retrievo --location=$REGION \
  --member=serviceAccount:$DEPLOY_SA --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding $RUN_SA \
  --member=serviceAccount:$DEPLOY_SA --role=roles/iam.serviceAccountUser
```

**3-4. GitHub Actions 인증 (Workload Identity Federation)**

키 파일 없이 GitHub Actions가 배포 계정으로 로그인하게 한다. 이 저장소의 main에서만 된다.

```bash
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc github --location=global \
  --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='$REPO' && assertion.ref=='refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding $DEPLOY_SA --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

# 4단계의 GCP_WIF_PROVIDER 값
echo projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github
```

## 4. GitHub 저장소 변수

저장소 → Settings → Secrets and variables → Actions → **Variables** 탭에 넣는다. 비밀값은 여기 두지 않는다. 비밀값은 Secret Manager에 있다.

| 이름 | 값 |
|---|---|
| `GCP_PROJECT_ID` | Google Cloud 프로젝트 ID |
| `GCP_WIF_PROVIDER` | 3-4단계 마지막 줄에 나온 값 |
| `RETRIEVO_PUBLIC_URL` | 2단계 Vercel 주소 (끝에 `/` 없이) |
| `DATABASE_URL` | 1단계 JDBC URL |
| `DATABASE_USERNAME` | `postgres.<프로젝트 ref>` |
| `KAKAO_CLIENT_ID` | 카카오 앱 REST API 키 (공개되는 값) |

`GCP_PROJECT_ID`가 없으면 배포 단계를 건너뛴다. 그래서 설정이 끝나기 전에도 CI는 그대로 돈다.

## 5. 첫 배포

1. 배포 워크플로를 실행한다.
   - Actions → **Backend** → Run workflow (main)
   - 테스트가 통과하면 배포한다.
2. 배포 로그 끝의 `Service URL`을 확인한다. 예) `https://retrievo-api-xxxx.a.run.app`
3. Vercel에 Cloud Run 주소를 넣고 다시 배포한다.
   - Settings → Environment Variables → `RETRIEVO_API_ORIGIN` = Service URL
   - Deployments → 최신 배포 → **Redeploy**
   - 넘겨줄 주소는 빌드할 때 정해지므로 다시 빌드해야 한다.
4. 카카오 개발자 앱에 Redirect URI를 추가한다.
   - 카카오 로그인 → Redirect URI → `<Vercel 주소>/login/oauth2/code/kakao`
5. Vercel 주소에서 확인한다.
   - 카카오 로그인
   - 오늘 화면
   - 문제 풀기

## 6. 문제 파일 자동 배포 (dev-lessons)

dev-lessons main에 문제 파일이 들어가면 자동으로 다시 배포하게 한다.
- dev-lessons의 `Check questions` 워크플로가 검사를 통과하면 이 저장소에 `content-updated` 신호를 보낸다.
- 이 저장소의 Backend 워크플로가 신호를 받아 테스트하고 배포한다.

신호를 보내려면 토큰이 필요하다. 토큰이 없으면 신호를 건너뛰고, 검사는 그대로 통과한다.

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
   - Token name: `dev-lessons → retrievo 배포 신호`
   - Expiration: 1년 (만료되면 다시 만들어 2단계를 반복한다)
   - Repository access: **Only select repositories** → `wanja727/retrievo` 하나만
   - Permissions → Repository permissions → **Contents: Read and write**. 신호(repository dispatch)를 보내는 데 필요한 권한이다. 나머지는 두지 않는다.
2. dev-lessons 저장소 → Settings → Secrets and variables → Actions → **Secrets** 탭 → New repository secret
   - Name: `RETRIEVO_DISPATCH_TOKEN`
   - Secret: 1번에서 만든 토큰
3. 확인: dev-lessons에서 문제 파일을 고쳐 main에 병합한다.
   - dev-lessons Actions의 `Check questions`에서 `notify-retrievo`가 통과한다.
   - 이 저장소 Actions에 `repository_dispatch`로 시작한 Backend 실행이 생긴다.

## 운영 메모

- **콜드 스타트:** 한동안 요청이 없다가 처음 들어온 요청은 서버가 켜지는 동안 10초 안팎 기다린다. 한국 시간 6시~밤 12시에는 Cloud Scheduler가 깨워 두어 거의 겪지 않는다. 비용 0원을 위해 고른 부분이다. 최소 1대를 켜 두면 월 수천 원이 든다.

Cloud Scheduler 작업은 Cloud Shell에서 만들었다.

```bash
gcloud services enable cloudscheduler.googleapis.com
gcloud scheduler jobs create http retrievo-keep-warm --location=asia-northeast3 \n  --schedule="*/10 6-23 * * *" --time-zone="Asia/Seoul" \n  --uri="https://retrievo-tau.vercel.app/api/lessons" --http-method=GET --attempt-deadline=60s
```
- **문제 파일이 바뀌었을 때:** dev-lessons main에 들어가면 자동으로 다시 배포한다(6단계). 토큰이 만료됐거나 급할 때는 Actions → Backend → Run workflow로 손으로 배포한다.
- **DB 스키마:** 앱 테이블은 Supabase의 `retrievo` 스키마에 있다. Supabase 대시보드 Table Editor에서는 스키마 선택을 `retrievo`로 바꿔야 보인다.
- **비용 상한:**
  - Cloud Run은 최대 1대만 띄운다.
  - 예산 알림은 메일만 보내고 서비스를 멈추지 않는다.

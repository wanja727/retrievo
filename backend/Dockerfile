# 운영 이미지 (Cloud Run). 빌드: docker build -t retrievo-api backend
# content/에 dev-lessons의 문제 파일(content/questions)을 넣고 빌드하면 시작할 때 가져온다. 비어 있으면 건너뛴다

FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
# 의존성만 먼저 받아 레이어 캐시를 쓴다
RUN sh ./gradlew --no-daemon dependencies > /dev/null
COPY src src
RUN sh ./gradlew --no-daemon bootJar && cp build/libs/*.jar app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 retrievo
COPY --from=build /src/app.jar app.jar
# 콜드 스타트를 줄이려고 CDS(클래스 데이터 공유)를 쓴다. Cloud Run은 요청이 없으면 0대라 켜질 때마다 클래스를 새로 읽는다.
# jar를 풀고, 앱을 한 번 띄워(빈을 다 만든 뒤 바로 끝낸다) 읽은 클래스를 app.jsa에 남긴다.
# 이때 DB에 붙지 않게 Flyway와 스키마 검사(ddl-auto)를 끄고 Hibernate가 DB 정보를 읽지 않게 한다. DataSource는 첫 연결 때 붙으므로 붙지 않는다
RUN java -Djarmode=tools -jar app.jar extract --destination extracted \
    && java -XX:ArchiveClassesAtExit=extracted/app.jsa -Dspring.context.exit=onRefresh \
        -Dspring.datasource.url=jdbc:postgresql://localhost:5432/cds \
        -Dspring.flyway.enabled=false -Dspring.jpa.hibernate.ddl-auto=none \
        -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
        -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
        -jar extracted/app.jar \
    && rm app.jar
COPY content/ content/
USER retrievo
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
EXPOSE 8080
ENTRYPOINT ["java", "-XX:SharedArchiveFile=extracted/app.jsa", "-jar", "extracted/app.jar"]

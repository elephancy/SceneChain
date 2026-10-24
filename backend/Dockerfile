FROM maven:3.9-eclipse-temurin-26 AS build
WORKDIR /work
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:25-jre-alpine
RUN apk upgrade --no-cache \
    && addgroup -S scenechain \
    && adduser -S -D -H -u 10001 -G scenechain scenechain
WORKDIR /app
COPY --from=build /work/target/scenechain-api-0.1.0.jar app.jar
USER scenechain
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/api/pack/status || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

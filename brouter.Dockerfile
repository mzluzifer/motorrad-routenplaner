# Baut den BRouter-Routing-Server aus dem Quellcode (alles Open Source).
# Stufe 1: bauen, Stufe 2: schlankes Laufzeit-Image.

FROM eclipse-temurin:21-jdk AS build
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 https://github.com/abrensch/brouter.git .
RUN ./gradlew --no-daemon clean build

FROM eclipse-temurin:21-jre
WORKDIR /app
# Fertiges Fat-Jar und Standardprofile (enthält das nötige lookups.dat)
COPY --from=build /src/brouter.jar /app/brouter.jar
COPY --from=build /src/misc/profiles2 /app/profiles2
# Eigene Motorrad-Profile zusätzlich bereitstellen
COPY backend/brouter-profiles/ /app/profiles2/

# segments4 = Routing-Daten (rd5), customprofiles = vom Backend hochgeladene Profile
VOLUME ["/app/segments4", "/app/customprofiles"]
EXPOSE 17777

# RouteServer <segmentdir> <profiledir> <customprofiledir> <port> <bind> <threads> <maxruntime>
CMD ["sh", "-c", "java -cp /app/brouter.jar btools.server.RouteServer /app/segments4 /app/profiles2 /app/customprofiles 17777 0.0.0.0 4 300"]

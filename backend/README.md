# Backend JAR

Place your Microcks Spring Boot JAR in this folder. Example:

- microcks.jar

The app will try to run: java -jar backend/microcks.jar --server.port=8080

You can override the path via environment variable MICROCKS_JAR.

If you want to bundle a JRE so end users don't need Java installed, add a `jre/` folder at the project root with the standard JRE structure (bin/java, etc.). electron-builder is configured to include it as extraResources.
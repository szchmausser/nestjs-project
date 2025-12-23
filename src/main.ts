import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

/**
 * FUNCIÓN DE ARRANQUE (Bootstrap)
 * Punto de entrada principal de la aplicación NestJS.
 * Aquí se configuran los middlewares globales que actúan antes de los Guards y Pipes.
 */
async function bootstrap() {
  // 1. Creación de la instancia de la aplicación basada en el módulo raíz (AppModule)
  const app = await NestFactory.create(AppModule);

  /**
   * 2. MIDDLEWARE: Cookie Parser
   * ¿POR QUÉ ES NECESARIO?:
   * Por defecto, Node.js/Express no saben leer las cookies del encabezado de la petición.
   * Este middleware intercepta la cabecera 'Cookie', la procesa y la transforma en
   * un objeto manejable dentro de 'request.cookies'.
   * * Vínculo con la seguridad:
   * Es fundamental para que nuestra 'JwtStrategy' pueda extraer el token JWT
   * directamente de las cookies del navegador de forma automática.
   */
  app.use(cookieParser());

  /**
   * 2. MIDDLEWARE: Global Exception Filter
   * ¿POR QUÉ ES NECESARIO?:
   * Implementamos un filtro global para manejar excepciones de manera centralizada.
   * Cada vez que ocurra un error en la aplicación, nuestro filtro lo captura y
   * responde con una respuesta estándar que contiene:
   * - Un estado HTTP apropiado
   * - Un mensaje descriptivo
   * - Un timestamp
   * - El path de la petición
   * - El error original (si es un objeto)
   * * Vínculo con la seguridad:
   * Aunque no es directamente relacionado con la seguridad, es una práctica
   * recomendada para mejorar la experiencia del usuario y la depuración.
   */
  app.useGlobalFilters(new AllExceptionsFilter());

  /**
   * 3. INICIO DEL SERVIDOR
   * Escucha en el puerto definido en las variables de entorno o por defecto en el 3000.
   */
  await app.listen(process.env.PORT ?? 3000);
}
/**
 * EJECUCIÓN DEL BOOTSTRAP
 * .catch() asegura que si la aplicación falla al iniciar (ej: puerto ocupado,
 * error de conexión a DB), el error se imprima en consola y el proceso se detenga limpiamente.
 */
bootstrap().catch((err) => {
  console.error('❌ Error starting the application:', err);
  process.exit(1); // Detiene el proceso con un código de error
});

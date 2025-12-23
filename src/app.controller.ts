import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { CurrentUser } from './common/decorators/current-user.decorator';
// Importación de tipo: Evita que el compilador busque una clase en tiempo de ejecución
// ya que 'UserPayload' es una interfaz que desaparece tras la compilación.
import type { UserPayload } from './auth/interfaces/user-payload.interface';

/**
 * CONTROLADOR DE PRUEBAS (TestController)
 * Este controlador sirve para validar el flujo de autenticación,
 * verificando el comportamiento de rutas públicas y protegidas.
 */
@Controller('test')
export class AppController {
  /**
   * ENDPOINT PÚBLICO
   * El decorador @Public() añade un metadato que el 'JwtAuthGuard' lee.
   * Si este metadato existe, el Guard permite el acceso sin validar ningún JWT.
   */
  @Public()
  @Get('public')
  getPublic() {
    return {
      message: 'Este es un endpoint público (No requiere token)',
      timestamp: new Date(),
    };
  }

  /**
   * ENDPOINT PROTEGIDO
   * Al no tener el decorador @Public(), el 'JwtAuthGuard' (global) intercepta la petición.
   * * @param user El decorador @CurrentUser() realiza lo siguiente:
   * 1. Accede al objeto Request de Express.
   * 2. Extrae la propiedad 'user' que Passport inyectó tras validar el JWT.
   * 3. Entrega el objeto tipado como 'UserPayload' directamente al método.
   * * ¿Por qué usamos UserPayload aquí?:
   * Para garantizar que dentro de este método tengamos autocompletado y seguridad
   * de que el usuario tiene 'id' y 'email', evitando el uso de 'any'.
   * La magia del Guard silencioso: No ves un @UseGuards(JwtAuthGuard) aquí porque asumimos
   * que lo tienes configurado de forma Global (en el AppModule). Este controlador confía en
   * que el "portero" ya hizo su trabajo.
   */

  @Get('protected')
  getProtected(@CurrentUser() user: UserPayload) {
    return {
      message: 'Acceso concedido: Token válido detectado',
      // Retornamos el payload extraído para confirmar que la identidad es correcta
      user,
      timestamp: new Date(),
    };
  }
}

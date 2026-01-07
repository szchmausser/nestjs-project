/**
 * ============================================================================
 * @file app.controller.ts
 * @description Controlador raíz para health checks y diagnóstico básico.
 * @module AppModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este controlador ha sido simplificado tras la modularización del proyecto.
 * Las funcionalidades de prueba de autorización se han movido a sus respectivos
 * módulos de dominio (Users, Posts).
 *
 * ============================================================================
 */

// NOTA: Se desactivan reglas de ESLint para permitir tipados flexibles
// en las respuestas de prueba y mapeos de objetos Prisma.

// ============================================================================
// IMPORTS - NestJS Core
// ============================================================================

import { Controller, Get } from '@nestjs/common';
import { Public } from './authentication/decorators/public.decorator';

// ============================================================================
// CONTROLADOR: AppController
// ============================================================================

/**
 * AppController
 * =============
 *
 * Controlador de pruebas bajo el prefijo '/test'.
 *
 * PROPÓSITO:
 * Proveer endpoints para verificar que el sistema de autenticación y
 * autorización funciona correctamente. Útil durante desarrollo y para
 * pruebas manuales con herramientas como Postman o curl.
 *
 * NOTA: En producción, considera restringir o remover este controlador
 * para evitar exposición de información sensible.
 */
@Controller()
export class AppController {
  constructor() {}

  /**
   * Health Check público.
   */
  @Public()
  @Get()
  getHello() {
    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }
}

/**
 * ============================================================================
 * @file conditions-parser.util.ts
 * @description Utilidad para procesar y transformar condiciones ABAC de CASL.
 * ============================================================================
 */

import * as Mustache from 'mustache';
import * as _ from 'lodash';
import { User } from '../casl-ability.factory';

/**
 * parseConditions
 * ===============
 *
 * Procesa las condiciones almacenadas en la base de datos (tipo MongoDB/Prisma),
 * interpolando variables del contexto del usuario usando Mustache.
 *
 * @param conditions - Objeto de condiciones original (JSON de la DB).
 * @param user - Instancia del usuario actual para interpolar variables ({{id}}, etc).
 * @returns Objeto de condiciones con variables resueltas y tipos corregidos.
 */
export function parseConditions(
  conditions: unknown,
  user: User,
): Record<string, unknown> | undefined {
  /**
   * GUARD: Condiciones nulas o no-objeto.
   * Es común que permisos no tengan condiciones (permisos globales).
   */
  if (
    conditions === null ||
    conditions === undefined ||
    typeof conditions !== 'object'
  ) {
    return undefined;
  }

  /**
   * _.cloneDeepWith():
   * Clona el objeto recursivamente, aplicando una transformación a cada valor string.
   */
  return _.cloneDeepWith(conditions, (value) => {
    if (_.isString(value)) {
      /**
       * Mustache.render():
       * Reemplaza placeholders {{variable}} con valores del objeto user.
       */
      const rendered = Mustache.render(value, user);

      /**
       * Conversión de strings numéricos a Number.
       * Mustache siempre retorna strings, pero en la DB campos como 'authorId' son Int.
       */
      if (/^\d+$/.test(rendered)) {
        return Number(rendered);
      }

      return rendered;
    }

    return undefined;
  }) as Record<string, unknown> | undefined;
}

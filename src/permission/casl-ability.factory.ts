/**
 * ============================================================================
 * @file casl-ability.factory.ts
 * @description Fábrica central para la gestión de permisos dinámicos con CASL.
 * @module PermissionModule
 * @version 2.0.0
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este archivo implementa el motor de autorización de la aplicación,
 * actuando como el "cerebro" que decide qué puede o no puede hacer cada usuario.
 *
 * MODELO DE AUTORIZACIÓN HÍBRIDO:
 * Combina tres paradigmas de control de acceso:
 *
 * 1. RBAC (Role-Based Access Control):
 *    - Los usuarios heredan permisos a través de roles predefinidos.
 *    - Ejemplo: El rol "EDITOR" incluye permisos para crear y editar Posts.
 *    - Flujo: User → UserRole → Role → RolePermission → Permission
 *
 * 2. ABAC (Attribute-Based Access Control):
 *    - Los permisos pueden tener condiciones basadas en atributos del recurso.
 *    - Ejemplo: { "authorId": "{{id}}" } permite solo acceder a recursos propios.
 *    - Las condiciones se evalúan en tiempo de ejecución mediante interpolación.
 *
 * 3. Claims (Permisos Directos):
 *    - Permisos asignados directamente al usuario, sin pasar por roles.
 *    - Pueden OTORGAR (inverted: false) o REVOCAR (inverted: true) capacidades.
 *    - Útil para excepciones, delegaciones temporales o sanciones.
 *
 * PATRONES DE DISEÑO UTILIZADOS:
 * - Factory Pattern: CaslAbilityFactory crea instancias de Ability personalizadas.
 * - Dependency Injection: Injectable de NestJS para inyección en Guards/Services.
 * - Delegate Pattern: Delega el parseo de condiciones a una utilidad especializada.
 *
 * DEPENDENCIAS EXTERNAS:
 * - @casl/ability: Librería core para definición y evaluación de permisos.
 * - @ucast/mongo2js: Evalúa condiciones MongoDB-style en objetos JavaScript.
 * - conditions-parser.util: Utilidad interna para procesar ABAC.
 *
 * ============================================================================
 */

// ============================================================================
// IMPORTS - Dependencias de CASL
// ============================================================================

/**
 * AbilityBuilder:
 * Clase helper de CASL que proporciona una API fluida para construir reglas.
 * Expone métodos `can()` y `cannot()` para definir lo que un usuario puede o no hacer.
 * Es el "constructor" que usamos para armar el set de permisos.
 *
 * MongoAbility:
 * Implementación de la clase Ability de CASL para queries tipo MongoDB.
 * Almacena las reglas definidas y proporciona el método `can(action, subject)`
 * para verificar permisos. Es la clase base para crear nuestra instancia tipada.
 *
 * createMongoAbility:
 * Función de CASL que crea una instancia de MongoAbility.
 * Reemplaza el uso directo del constructor de Ability/PureAbility en v6.
 *
 * ExtractSubjectType:
 * Utility type que extrae el tipo "subject" de una colección de Subjects.
 * Se usa en detectSubjectType para obtener el nombre de la clase como string.
 *
 * InferSubjects:
 * Utility type que infiere los tipos de subjects válidos a partir de clases.
 * Con el 2do parámetro en `true`, genera tanto la clase como el string literal.
 * Ejemplo: InferSubjects<typeof Post, true> = Post | 'Post'
 */
import {
  AbilityBuilder,
  ExtractSubjectType,
  InferSubjects,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';

// ============================================================================
// IMPORTS - NestJS
// ============================================================================

/**
 * Injectable:
 * Decorador de NestJS que marca esta clase como "inyectable" en el contenedor IoC.
 * Permite que CaslAbilityFactory sea inyectada en Guards, Services y Controllers.
 * Sin este decorador, NestJS no podría resolver las dependencias automáticamente.
 */
import { Injectable } from '@nestjs/common';

// ============================================================================
// IMPORTS - Utilidades Internas
// ============================================================================
import { parseConditions } from './utils/conditions-parser.util';

// ============================================================================
// IMPORTS - Tipos de Prisma (Generados automáticamente)
// ============================================================================

/**
 * Estos tipos son generados automáticamente por Prisma CLI (`npx prisma generate`)
 * basándose en el schema.prisma del proyecto. Se importan desde la carpeta
 * `generated/prisma/client` según la configuración del generator.
 *
 * User (as PrismaUser):
 * Tipo que representa la estructura del modelo User en la base de datos.
 * Renombrado a PrismaUser para evitar conflicto con nuestra clase wrapper User.
 *
 * Post (as PrismaPost):
 * Tipo que representa la estructura del modelo Post en la base de datos.
 * Renombrado a PrismaPost para evitar conflicto con nuestra clase wrapper Post.
 *
 * UserRole:
 * Tipo de la tabla intermedia User ↔ Role. Contiene userId, roleId,
 * y metadatos como assignedAt, expiresAt.
 *
 * Role:
 * Tipo del modelo Role (id, name, description, isActive).
 *
 * RolePermission:
 * Tipo de la tabla intermedia Role ↔ Permission.
 *
 * Permission:
 * Tipo del modelo Permission (id, action, subject, conditions, description).
 *
 * UserPermission:
 * Tipo de la tabla intermedia User ↔ Permission (claims directos).
 * Incluye el campo `inverted` para distinguir grants de revokes.
 *
 * Action:
 * Enum generado por Prisma con las acciones válidas del sistema:
 * - 'manage': Wildcard, representa TODAS las acciones.
 * - 'create': Crear nuevos recursos.
 * - 'read': Leer/consultar recursos.
 * - 'update': Modificar recursos existentes.
 * - 'delete': Eliminar recursos.
 */
import {
  User as PrismaUser,
  Post as PrismaPost,
  UserRole,
  Role,
  RolePermission,
  Permission,
  UserPermission,
  Action,
} from 'generated/prisma/client';

// ============================================================================
// CLASES WRAPPER (Envoltorio para entidades de Prisma)
// ============================================================================

/**
 * ¿POR QUÉ SON NECESARIAS ESTAS CLASES WRAPPER?
 * =============================================
 *
 * PROBLEMA:
 * CASL necesita identificar el tipo de un objeto (Subject) para aplicar las reglas.
 * Cuando llamas `ability.can('update', somePost)`, CASL debe saber que `somePost`
 * es de tipo 'Post' para buscar reglas que apliquen a 'Post'.
 *
 * DESAFÍO:
 * Prisma devuelve objetos literales planos de JavaScript (POJOs), no instancias
 * de clases. Estos objetos no tienen un prototipo claro, su `constructor.name`
 * sería simplemente 'Object'.
 *
 * SOLUCIÓN:
 * Al crear clases wrapper (Post, User) y convertir los objetos de Prisma en
 * instancias de estas clases, CASL puede usar `item.constructor.name` para
 * obtener 'Post' o 'User', permitiendo la correcta evaluación de reglas.
 *
 * IMPLEMENTACIÓN TÉCNICA:
 * - Las clases implementan `Partial<PrismaX>` para heredar el tipado.
 * - El constructor usa `Object.assign(this, partial)` para copiar propiedades.
 * - Las propiedades usan `!:` (definite assignment assertion) porque son
 *   asignadas dinámicamente en runtime, no en la declaración.
 */

/**
 * Post
 * ====
 *
 * Clase wrapper para convertir objetos Post de Prisma en instancias tipadas.
 *
 * USO TÍPICO:
 * ```typescript
 * const prismaPost = await prisma.post.findUnique({ where: { id: 1 } });
 * const post = new Post(prismaPost);
 * const canUpdate = ability.can('update', post);
 * ```
 *
 * PROPIEDADES RELEVANTES PARA ABAC:
 * - authorId: Usado en condiciones de ownership ({ "authorId": "{{id}}" }).
 * - isPublished: Usado en condiciones de estado ({ "isPublished": false }).
 *
 * NOTA: El `!:` después del nombre indica a TypeScript que estas propiedades
 * serán inicializadas en runtime (por Object.assign), no en el constructor.
 */
export class Post implements Partial<PrismaPost> {
  /**
   * Constructor que asigna todas las propiedades del objeto Prisma a esta instancia.
   *
   * @param partial - Objeto parcial con propiedades del Post de Prisma.
   *                  Acepta Partial<> para permitir crear Posts con datos mínimos
   *                  (útil para testing o when solo necesitas algunas propiedades).
   */
  constructor(partial: Partial<PrismaPost>) {
    Object.assign(this, partial);
  }

  /** Identificador único del post en la base de datos. */
  id!: number;

  /**
   * ID del usuario autor del post.
   * Crítico para condiciones ABAC de ownership.
   * Ejemplo de condición: { "authorId": "{{id}}" }
   */
  authorId!: number;

  /**
   * Estado de publicación del post.
   * Usado para condiciones de visibilidad.
   * Ejemplo: { "isPublished": true } para permitir solo posts públicos.
   */
  isPublished!: boolean;
}

/**
 * User
 * ====
 *
 * Clase wrapper para el usuario con su jerarquía completa de permisos.
 *
 * ESTRUCTURA ANIDADA:
 * Esta clase incluye tipado profundo (deep typing) para las relaciones:
 *
 * User
 * └── roles: UserRole[]
 *     └── role: Role
 *         └── permissions: RolePermission[]
 *             └── permission: Permission
 * └── directPermissions: UserPermission[]
 *     └── permission: Permission
 *
 * ORIGEN DE LOS DATOS:
 * La estructura anidada es cargada por `PermissionService.getUserWithPermissions()`,
 * que hace un query con múltiples `include` para traer toda la jerarquía.
 *
 * NOTA: Las propiedades usan `!:` (definite assignment assertion) porque son
 * asignadas dinámicamente en el constructor vía Object.assign().
 */
export class User implements Partial<PrismaUser> {
  /**
   * Constructor que asigna todas las propiedades del objeto de usuario.
   *
   * @param partial - Objeto con datos del usuario incluyendo roles y permisos.
   *                  Típicamente viene de PermissionService.getUserWithPermissions().
   */
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }

  /** Identificador único del usuario en la base de datos. */
  id!: number;

  /** Email único del usuario, usado para autenticación. */
  email!: string;

  /**
   * Roles asignados al usuario con su estructura completa.
   *
   * TIPADO PROFUNDO EXPLICADO:
   * - UserRole: Tabla intermedia (userId, roleId, expiresAt, assignedBy, etc.)
   *   - role: Role: El rol en sí (id, name, description, isActive)
   *     - permissions: RolePermission[]: Permisos que componen el rol
   *       - permission: Permission: El permiso atómico (action, subject, conditions)
   *
   * Este tipado refleja exactamente lo que devuelve el query de Prisma
   * con los `include` anidados en PermissionService.
   */
  roles!: (UserRole & {
    role: Role & {
      permissions: (RolePermission & {
        permission: Permission;
      })[];
    };
  })[];

  /**
   * Permisos asignados directamente al usuario (Claims).
   *
   * TIPADO PROFUNDO:
   * - UserPermission: Tabla intermedia con metadatos importantes:
   *   - inverted: boolean → false = GRANT, true = REVOKE
   *   - reason: string → Justificación de la asignación
   *   - expiresAt: Date → Control temporal
   *   - permission: Permission → El permiso en sí
   *
   * ORDEN DE APLICACIÓN:
   * Los directPermissions se procesan DESPUÉS de los roles:
   * 1. Primero se aplican los grants (inverted: false) → Expanden capacidades
   * 2. Luego se aplican los revokes (inverted: true) → Restringen capacidades
   */
  directPermissions!: (UserPermission & {
    permission: Permission;
  })[];
}

// ============================================================================
// TIPOS DE CASL
// ============================================================================

/**
 * Subjects
 * ========
 *
 * Type alias que define TODOS los tipos de "subject" válidos para CASL.
 *
 * ¿QUÉ ES UN SUBJECT?:
 * En CASL, un "subject" es el OBJETO sobre el cual se realiza una acción.
 * - En "El usuario puede LEER Posts", 'Post' es el subject.
 * - En "El usuario puede ELIMINAR su propio perfil", el perfil User es el subject.
 *
 * COMPOSICIÓN DEL TIPO:
 *
 * 1. InferSubjects<typeof Post | typeof User, true>
 *    - Infiere tipos a partir de las clases Post y User.
 *    - El `true` como 2do parámetro habilita "strict subject types".
 *    - Produce: Post | User | 'Post' | 'User'
 *
 * 2. Literales string adicionales ('Post', 'User'):
 *    - Agregados explícitamente para GARANTIZAR que los string literals
 *      existan en el tipo, independientemente de la inferencia.
 *    - Esto es importante porque en @CheckPolicies usamos strings:
 *      ability.can('create', 'Post')
 *
 * 3. 'all':
 *    - Valor especial de CASL que representa CUALQUIER subject.
 *    - Usado para permisos de super-administrador: can('manage', 'all')
 *
 * USO EN CÓDIGO:
 * - Con instancia: ability.can('update', postInstance)
 * - Con string: ability.can('create', 'Post')
 * - Wildcard: ability.can('manage', 'all')
 */
export type Subjects =
  | InferSubjects<typeof Post | typeof User, true>
  | 'Post'
  | 'User'
  | 'all';

/**
 * AppAbility
 * ==========
 *
 * Tipo que representa la instancia de Ability configurada para nuestra aplicación.
 *
 * ANATOMÍA DEL TIPO:
 * PureAbility<[Action, Subjects]>
 *
 * - PureAbility: Clase base de CASL (versión sin efectos secundarios).
 * - [Action, Subjects]: Tupla que define los tipos de:
 *   - Action: Enum de Prisma con acciones válidas (manage, create, read, update, delete).
 *   - Subjects: Nuestro type alias con los subjects válidos.
 *
 * ¿POR QUÉ MongoAbility Y NO PureAbility?:
 * - PureAbility: Versión ligera, inmutable después de creada.
 * - MongoAbility: Especialización de PureAbility para operadores de MongoDB.
 * - Usamos MongoAbility porque es el estándar recomendado en CASL v6 para
 *   interactuar con condiciones tipo MongoDB (las que usamos en Prisma/DB).
 *
 * MÉTODOS PRINCIPALES (heredados de PureAbility):
 * - can(action, subject): Verifica si la acción está permitida.
 * - cannot(action, subject): Verifica si la acción está prohibida.
 * - relevantRuleFor(action, subject): Obtiene la regla que aplica.
 */
export type AppAbility = MongoAbility<[Action, Subjects]>;

// ============================================================================
// FÁBRICA DE ABILITIES (Servicio Principal)
// ============================================================================

/**
 * CaslAbilityFactory
 * ==================
 *
 * Servicio inyectable que construye instancias de AppAbility personalizadas
 * para cada usuario basándose en sus roles y permisos directos.
 *
 * PATRÓN FACTORY:
 * Esta clase implementa el patrón Factory porque su responsabilidad es
 * CREAR objetos (Abilities) con una lógica de construcción compleja.
 * El consumidor (PoliciesGuard) solo llama createAbility(user) sin
 * conocer los detalles de cómo se construyen las reglas.
 *
 * CICLO DE VIDA:
 * 1. PoliciesGuard recibe una request con JWT.
 * 2. JwtAuthGuard valida el token y extrae el userId.
 * 3. PermissionService carga el usuario con toda su jerarquía de permisos.
 * 4. CaslAbilityFactory.createAbility() construye el Ability.
 * 5. PoliciesGuard usa el Ability para evaluar las policies del endpoint.
 *
 * INYECCIÓN:
 * Registrado como provider en PermissionModule y exportado para uso global.
 */
@Injectable()
export class CaslAbilityFactory {
  /**
   * createAbility
   * =============
   *
   * Método principal que construye el set de habilidades (abilities) para un usuario.
   *
   * LÓGICA DE PRIORIDAD (CRÍTICO):
   * El orden de definición de reglas en CASL determina qué prevalece.
   * LA ÚLTIMA REGLA QUE COINCIDE ES LA QUE GANA.
   *
   * Por esto, las reglas se aplican en este orden:
   *
   * 1. PERMISOS DE ROLES (Base):
   *    - Se cargan primero como "permisos base".
   *    - Establece lo que el usuario puede hacer por su función.
   *
   * 2. GRANTS DIRECTOS (Claims positivos, inverted: false):
   *    - Se cargan después para EXPANDIR capacidades.
   *    - Pueden dar permisos que los roles no incluyen.
   *    - Sobrescriben cualquier cannot previo (porque van después).
   *
   * 3. REVOKES (Claims negativos, inverted: true):
   *    - Se cargan AL FINAL para RESTRINGIR capacidades.
   *    - Tienen la MÁXIMA PRIORIDAD porque son las últimas reglas.
   *    - Un revoke SIEMPRE gana sobre un can (del rol o grant).
   *
   * EJEMPLO PRÁCTICO:
   * - Rol EDITOR tiene: can('delete', 'Post')
   * - Usuario tiene claim: inverted: true, action: 'delete', subject: 'Post'
   * - Resultado: Usuario NO puede eliminar posts (revoke gana al final).
   *
   * @param user - Usuario con su jerarquía de permisos cargada.
   *               Viene de PermissionService.getUserWithPermissions().
   * @returns AppAbility - Instancia configurada con todas las reglas del usuario.
   */
  createAbility(user: User): AppAbility {
    /**
     * const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
     *
     * - can(action, subject, conditions?): Define que el usuario PUEDE hacer algo.
     * - cannot(action, subject, conditions?): Define que el usuario NO PUEDE hacer algo.
     * - build: Función para construir la instancia final de Ability.
     *
     * createMongoAbility es el constructor moderno para CASL v6.
     */
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    /**
     * GUARD: Usuario nulo o inválido.
     * Si no hay usuario (token inválido, usuario eliminado, etc.),
     * retornamos un Ability vacío (sin permisos).
     */
    if (user) {
      // ====================================================================
      // PASO 1: Cargar permisos de ROLES (Base)
      // ====================================================================
      /**
       * Recorremos todos los roles asignados al usuario.
       * Para cada rol, recorremos sus permisos y los registramos como `can()`.
       *
       * NOTA sobre el tipado:
       * - rp.permission.subject es String en Prisma pero sabemos que solo
       *   contiene valores válidos (Post, User, all).
       * - Usamos `as SubjectString` para type-safety sin perder el valor.
       */
      user.roles.forEach((ur) => {
        ur.role.permissions.forEach((rp) => {
          can(
            rp.permission.action,
            rp.permission.subject,
            parseConditions(rp.permission.conditions, user),
          );
        });
      });

      // ====================================================================
      // PASO 2: Cargar GRANTS directos (inverted: false)
      // ====================================================================
      /**
       * Filtramos los directPermissions que NO están invertidos.
       * Estos son permisos adicionales que EXPANDEN las capacidades del usuario.
       */
      user.directPermissions
        .filter((dp) => !dp.inverted)
        .forEach((dp) => {
          can(
            dp.permission.action,
            dp.permission.subject,
            parseConditions(dp.permission.conditions, user),
          );
        });

      // ====================================================================
      // PASO 3: Cargar REVOKES (inverted: true)
      // ====================================================================
      /**
       * ¡CRÍTICO! Estos se aplican AL FINAL.
       * En CASL, la última regla que coincide prevalece.
       */
      user.directPermissions
        .filter((dp) => dp.inverted)
        .forEach((dp) => {
          cannot(
            dp.permission.action,
            dp.permission.subject,
            parseConditions(dp.permission.conditions, user),
          ).because(dp.reason ?? '');
        });
    }

    // ======================================================================
    // CONSTRUCCIÓN FINAL DEL ABILITY
    // ======================================================================
    /**
     * build():
     * Genera la instancia final de AppAbility consolidando todas las reglas
     * definidas previamente mediante can() y cannot().
     *
     * I. MECÁNICA INTERNA:
     * -------------------
     * Esta función es un "shortcut" que invoca internamente a `createMongoAbility`
     * (la función que pasamos al constructor del Builder) pasándole automáticamente
     * el array de reglas acumuladas.
     *
     * II. CONFIGURACIÓN (detectSubjectType):
     * -------------------------------------
     * Es el parámetro más crítico para la integración con Clases/Prisma. Define la
     * lógica para identificar el "sujeto" (recurso) sobre el cual se evalúan las reglas.
     *
     * ESTRATEGIA DE IDENTIFICACIÓN (Comportamiento Dual):
     * - Evaluación por Instancia: Para verificar condiciones ABAC sobre registros existentes.
     *   Ejemplo: `ability.can('update', new Post({ authorId: 1 }))` -> Aqui se envia un objeto Post
     *   Internamente: `(post).constructor.name` -> `'Post'` (CASL valida authorId).
     *
     * - Evaluación por Tipo: Para verificar permisos generales sin tener el objeto.
     *   Ejemplo: `ability.can('update', 'Post')` -> Aqui se envia un string 'Post'
     *   Internamente: `('Post').constructor.name` -> `'String'` -> CASL usa el literal.
     *   (O usando la clase: `ability.can('update', Post)`)
     *
     * III. REHIDRATACIÓN Y MATCHEO:
     * ----------------------------
     * Prisma devuelve objetos planos (POJOs). Como un POJO no tiene clase, su
     * `post.constructor.name` sería simplemente `'Object'`, lo que rompería las reglas de CASL.
     *
     * Para solucionarlo, "volvemos a instanciar" el resultado usando nuestras clases wrapper.
     * Este proceso de "rehidratación" garantiza que tanto `postWrapper` como `userWrapper`
     * expongan los nombres de clase correctos ('Post', 'User'), permitiendo que CASL
     * identifique el subject al matchear las reglas de la base de datos con los objetos reales.
     *
     * IV. EJEMPLO DE USO EN UN SERVICIO (Patrón de Implementación):
     * -------------------------------------------------------------
     * A continuación, se muestra el patrón estándar de uso real en un servicio:
     *
     * ```typescript
     *   async verifyPostAccess(
     *     userId: number,
     *     postId: number,
     *     action: Action,
     *   ) {
     *     const post = await this.prisma.post.findUnique({ where: { id: postId } });
     *     if (!post) {
     *       throw new NotFoundException(`Post con ID ${postId} no encontrado`);
     *     }
     *
     *     const user = await this.getUserWithPermissions(userId);
     *     const userWrapper = new User(user);
     *     const ability = this.abilityFactory.createAbility(userWrapper);
     *
     *     const postWrapper = new Post(post);
     *     const canPerform = ability.can(action, postWrapper);
     *
     *     if (!canPerform) throw new ForbiddenException("Sin permiso");
     *
     *     // 5. Ejecutar Acción
     *     // Tu lógica de negocio aquí (ej: update, delete, etc.)
     *     return { success: true, data: post };
     *   }
     * ```
     *
     * Como se vio en el código arriba, este flujo cierra el ciclo de autorización:
     * 1. Se "rehidratan" los POJOs de Prisma envolviéndolos en sus clases wrapper.
     * 2. Esto permite que `detectSubjectType` identifique el tipo de recurso ('Post').
     * 3. Finalmente, CASL puede matchear las reglas de la base de datos con los
     *    objetos en memoria para evaluar correctamente las condiciones ABAC.
     */
    return build({
      detectSubjectType: (item) =>
        (item as object).constructor.name as ExtractSubjectType<Subjects>,
    });
  }
}

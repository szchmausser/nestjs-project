-- =============================================================================
-- SEMILLA DE DATOS CORREGIDA (INCLUYE PASSWORD Y TIMESTAMPS)
-- =============================================================================

-- 1. LIMPIEZA DE TABLAS
DELETE FROM "Post";
DELETE FROM "UserPermission";
DELETE FROM "RolePermission";
DELETE FROM "UserRole";
DELETE FROM "Permission";
DELETE FROM "Role";
DELETE FROM "User";

-- 2. DEFINICIÓN DE PERMISOS ATÓMICOS
INSERT INTO "Permission" (id, action, subject, description, conditions, createdAt, updatedAt) VALUES
(1, 'manage', 'all', 'Super usuario: acceso total', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'read', 'Post', 'Ver cualquier publicación', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'create', 'Post', 'Crear nuevas publicaciones', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'update', 'Post', 'Editar publicaciones (ABAC)', '{"authorId": "${user.id}"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'delete', 'Post', 'Eliminar publicaciones (ABAC)', '{"authorId": "${user.id}"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 'read', 'User', 'Ver perfiles de usuario', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. DEFINICIÓN DE ROLES
INSERT INTO "Role" (id, name, description, isActive, createdAt, updatedAt) VALUES
(1, 'ADMIN', 'Administrador con acceso total', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'EDITOR', 'Usuario que puede crear y gestionar su contenido', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'VIEWER', 'Usuario de solo lectura', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'INACTIVE_ROLE', 'Rol deshabilitado para pruebas', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 4. ASIGNACIÓN DE PERMISOS A ROLES
INSERT INTO "RolePermission" (roleId, permissionId) VALUES (1, 1);
INSERT INTO "RolePermission" (roleId, permissionId) VALUES (2, 2), (2, 3), (2, 4), (2, 5);
INSERT INTO "RolePermission" (roleId, permissionId) VALUES (3, 2);

-- 5. USUARIOS (Añadido campo 'password')
-- Usamos un hash ficticio: '$2b$10$EPf9SUIh9qCwe5Yf88S3OuN6EkK5T..dummyhash'
INSERT INTO "User" (id, email, password, name, isActive, deletedAt, createdAt, updatedAt) VALUES
(1, 'admin@system.com', 'password123', 'Super Admin', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'editor.simple@test.com', 'password123', 'Editor Único', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'viewer.simple@test.com', 'password123', 'Viewer Único', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'multi.role@test.com', 'password123', 'Usuario Multi Rol', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'direct.only@test.com', 'password123', 'Usuario Solo Claims', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 'clean@test.com', 'password123', 'Usuario Limpio', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 'inactive@test.com', 'password123', 'Usuario Inactivo', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 'deleted@test.com', 'password123', 'Usuario Borrado', 1, '2023-10-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(9, 'sanctioned@test.com', 'password123', 'Editor Sancionado', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(10, 'expired.role@test.com', 'password123', 'Rol Expirado', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(11, 'temp.grant@test.com', 'password123', 'Consultor Temporal', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 6. ASIGNACIÓN DE ROLES
INSERT INTO "UserRole" (userId, roleId, assignedBy, assignedAt) VALUES 
(1, 1, 1, CURRENT_TIMESTAMP),
(2, 2, 1, CURRENT_TIMESTAMP),
(3, 3, 1, CURRENT_TIMESTAMP),
(4, 2, 1, CURRENT_TIMESTAMP), 
(4, 3, 1, CURRENT_TIMESTAMP),
(9, 2, 1, CURRENT_TIMESTAMP),
(10, 1, 1, CURRENT_TIMESTAMP);

UPDATE "UserRole" SET expiresAt = '2023-01-01 00:00:00' WHERE userId = 10;

-- 7. PERMISOS DIRECTOS / CLAIMS
INSERT INTO "UserPermission" (userId, permissionId, inverted, reason, assignedBy, assignedAt) VALUES 
(5, 2, 0, 'Acceso especial de lectura sin rol', 1, CURRENT_TIMESTAMP),
(5, 3, 0, 'Acceso especial de creación sin rol', 1, CURRENT_TIMESTAMP),
(9, 5, 1, 'Sanción: Prohibido borrar contenido por 30 días', 1, CURRENT_TIMESTAMP),
(11, 6, 0, 'Consultoría temporal de auditoría', 1, CURRENT_TIMESTAMP);

UPDATE "UserPermission" SET expiresAt = '2026-12-31 23:59:59' WHERE userId = 11;

-- 8. DATOS DE DOMINIO (Post)
INSERT INTO "Post" (id, title, content, authorId, isPublished, createdAt, updatedAt) VALUES
(1, 'Post de Admin', 'Contenido del admin', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'Post de Editor', 'Contenido del editor', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'Borrador de Editor', 'Aún no publicado', 2, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'Post de Sancionado', 'Contenido del usuario sancionado', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "UserRole" (userId, roleId, assignedBy, assignedAt) VALUES 
(12, 1, 1, CURRENT_TIMESTAMP);


-- database: /home/vioscar/proyectos/nestjs-project/dev.db

-- 1. Creamos un permiso de borrado GLOBAL (sin condiciones)
INSERT INTO Permission (action, subject, conditions, description, updatedAt) 
VALUES (
    'delete', 
    'Post', 
    NULL, -- Sin condiciones = Aplica a TODO
    'Prohibición total de eliminación de posts',
    CURRENT_TIMESTAMP
);

INSERT INTO UserPermission (userId, permissionId, inverted, reason, assignedBy, assignedAt)
SELECT 
    12, 
    id, 
    1, -- INVERTED = CANNOT
    'Sanción total: No puede borrar NADA de Post', 
    1, 
    CURRENT_TIMESTAMP
FROM Permission 
WHERE action = 'delete' AND subject = 'Post' AND conditions IS NULL
LIMIT 1;

----------------------------------------------------------------------------------

-- 1. Limpiamos cualquier rastro de la prueba fallida
DELETE FROM UserPermission WHERE userId = 12;

-- 2. Creamos el permiso específico con la sintaxis Mustache {{id}}
INSERT INTO Permission (action, subject, conditions, description, updatedAt) 
VALUES (
    'delete', 
    'Post', 
    '{"authorId": "{{id}}"}', 
    'Restricción para posts propios (Mustache)',
    CURRENT_TIMESTAMP
);

-- 3. Lo asignamos al usuario 12 como PROHIBICIÓN (inverted=1)
INSERT INTO UserPermission (userId, permissionId, inverted, reason, assignedBy, assignedAt)
SELECT 
    12, 
    id, 
    1, 
    'Auto-restricción: Prohibido borrar mis posts', 
    1, 
    CURRENT_TIMESTAMP
FROM Permission 
WHERE action = 'delete' 
  AND subject = 'Post' 
  AND conditions = '{"authorId": "{{id}}"}' -- Match exacto con el nuevo
LIMIT 1;


----------------------------------------------------------------------------------

-- Agregamos la restricción de posts AJENOS (el que usa $ne)
-- Nota: No borramos nada, solo sumamos este nuevo permiso
INSERT INTO Permission (action, subject, conditions, description, updatedAt) 
VALUES (
    'delete', 
    'Post', 
    '{"authorId": {"$ne": "{{id}}" }}', 
    'Permiso restrictivo: No eliminar posts ajenos',
    CURRENT_TIMESTAMP
);

INSERT INTO UserPermission (userId, permissionId, inverted, reason, assignedBy, assignedAt)
SELECT 
    12, 
    id, 
    1, -- INVERTED = True
    'Restricción extra: Tampoco puede borrar posts ajenos', 
    1, 
    CURRENT_TIMESTAMP
FROM Permission 
WHERE action = 'delete' 
  AND subject = 'Post' 
  AND conditions LIKE '%$ne%' -- Buscamos el permiso de "NOT EQUAL"
LIMIT 1;

-- CONSULTAS PARA PROBAR EL ABAC
-- database: /home/vioscar/proyectos/nestjs-project/dev.db

-- INSERT INTO "UserRole" (userId, roleId, assignedBy, assignedAt) VALUES 
-- (12, 1, 1, CURRENT_TIMESTAMP);

----------------------------------------------------------------------------------

-- 1. Creamos un permiso de borrado GLOBAL (sin condiciones)
-- INSERT INTO Permission (action, subject, conditions, description, updatedAt) 
-- VALUES (
--     'delete', 
--     'Post', 
--     NULL, -- Sin condiciones = Aplica a TODO
--     'Prohibición total de eliminación de posts',
--     CURRENT_TIMESTAMP
-- );

-- INSERT INTO UserPermission (userId, permissionId, inverted, reason, assignedBy, assignedAt)
-- SELECT 
--     12, 
--     id, 
--     1, -- INVERTED = CANNOT
--     'Sanción total: No puede borrar NADA de Post', 
--     1, 
--     CURRENT_TIMESTAMP
-- FROM Permission 
-- WHERE action = 'delete' AND subject = 'Post' AND conditions IS NULL
-- LIMIT 1;

----------------------------------------------------------------------------------

-- 1. Limpiamos cualquier rastro de la prueba fallida
-- DELETE FROM UserPermission WHERE userId = 12;

-- 2. Creamos el permiso específico con la sintaxis Mustache {{id}}
-- INSERT INTO Permission (action, subject, conditions, description, updatedAt) 
-- VALUES (
--     'delete', 
--     'Post', 
--     '{"authorId": "{{id}}"}', 
--     'Restricción para posts propios (Mustache)',
--     CURRENT_TIMESTAMP
-- );

-- 3. Lo asignamos al usuario 12 como PROHIBICIÓN (inverted=1)
-- INSERT INTO UserPermission (userId, permissionId, inverted, reason, assignedBy, assignedAt)
-- SELECT 
--     12, 
--     id, 
--     1, 
--     'Auto-restricción: Prohibido borrar mis posts', 
--     1, 
--     CURRENT_TIMESTAMP
-- FROM Permission 
-- WHERE action = 'delete' 
--   AND subject = 'Post' 
--   AND conditions = '{"authorId": "{{id}}"}' -- Match exacto con el nuevo
-- LIMIT 1;

----------------------------------------------------------------------------------

-- Agregamos la restricción de posts AJENOS (el que usa $ne)
-- Nota: No borramos nada, solo sumamos este nuevo permiso
-- INSERT INTO Permission (action, subject, conditions, description, updatedAt) 
-- VALUES (
--     'delete', 
--     'Post', 
--     '{"authorId": {"$ne": "{{id}}" }}', 
--     'Permiso restrictivo: No eliminar posts ajenos',
--     CURRENT_TIMESTAMP
-- );

-- INSERT INTO UserPermission (userId, permissionId, inverted, reason, assignedBy, assignedAt)
-- SELECT 
--     12, 
--     id, 
--     1, -- INVERTED = True
--     'Restricción extra: Tampoco puede borrar posts ajenos', 
--     1, 
--     CURRENT_TIMESTAMP
-- FROM Permission 
-- WHERE action = 'delete' 
--   AND subject = 'Post' 
--   AND conditions LIKE '%$ne%' -- Buscamos el permiso de "NOT EQUAL"
-- LIMIT 1;
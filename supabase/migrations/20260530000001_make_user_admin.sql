INSERT INTO user_roles (user_id, role)
VALUES ('8a9fcd3b-d93b-4fc0-89ce-ac7960715f28', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

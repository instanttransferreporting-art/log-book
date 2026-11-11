-- Journal d'audit en ajout seul : interdit DELETE et toute modification,
-- sauf la mise à NULL de userId (ON DELETE SET NULL de la clé étrangère).
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog est en ajout seul';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.action IS DISTINCT FROM OLD.action
     OR NEW."resourceType" IS DISTINCT FROM OLD."resourceType" OR NEW."resourceId" IS DISTINCT FROM OLD."resourceId"
     OR NEW."oldValues" IS DISTINCT FROM OLD."oldValues" OR NEW."newValues" IS DISTINCT FROM OLD."newValues"
     OR NEW.ip IS DISTINCT FROM OLD.ip OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."userId" IS NOT NULL) THEN
    RAISE EXCEPTION 'AuditLog est en ajout seul';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_change
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

# kit-veterinaria - Development Guide

## Database Triggers

If your plugin needs PostgreSQL triggers, follow this naming convention so the system
can automatically manage them when the plugin is activated/deactivated:

- **Trigger name**: `trg_kit_veterinaria_{descriptive_name}`
- **Function name**: `trg_kit_veterinaria_{descriptive_name}_fn`

Where `kit_veterinaria` is your plugin's moduleId (pluginId with hyphens replaced by underscores).

### Example

```sql
-- In a Drizzle migration file (drizzle/NNNN_name.sql):

CREATE OR REPLACE FUNCTION "trg_kit_veterinaria_audit_log_fn"()
RETURNS TRIGGER AS $$
BEGIN
  -- Your trigger logic here
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_kit_veterinaria_audit_log"
AFTER INSERT OR UPDATE ON "module_kit_veterinaria_items"
FOR EACH ROW
EXECUTE FUNCTION "trg_kit_veterinaria_audit_log_fn"();
```

> **Important**: The system automatically **DISABLE**s all `trg_kit_veterinaria_*` triggers when the plugin
> is deactivated, and **ENABLE**s them when reactivated. Triggers that don't follow this naming
> convention will NOT be managed automatically.

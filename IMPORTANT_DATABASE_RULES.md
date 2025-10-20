# ⚠️ CRITICAL: Database Schema Changes

## DO NOT USE `prisma db push` - EVER!

This file exists to prevent destructive database operations.

## Correct Process for ALL Schema Changes

### 1. Create Migration (Safe - Doesn't Apply Yet)
```bash
pnpm exec prisma migrate dev --name descriptive_migration_name --create-only
```

### 2. Review Generated SQL
- Check `prisma/migrations/` for the new migration folder
- Review the SQL file for:
  - Data loss warnings
  - Constraint violations
  - Column drops/renames
  - Index changes

### 3. Apply Migration Safely
```bash
# For development
pnpm exec prisma migrate dev

# For production
pnpm exec prisma migrate deploy
```

## Why `db push` is Dangerous

| `db push` (BAD) | Migrations (GOOD) |
|-----------------|-------------------|
| ❌ Can lose data silently | ✅ Warns about data loss |
| ❌ No history | ✅ Version controlled |
| ❌ Can't rollback | ✅ Can rollback |
| ❌ No review step | ✅ Review before applying |
| ❌ Destructive | ✅ Safe and auditable |

## Common Scenarios

### Adding a New Model
```bash
# 1. Edit schema.prisma
# 2. Create migration
pnpm exec prisma migrate dev --name add_shipment_types --create-only

# 3. Review the SQL
cat prisma/migrations/*/migration.sql

# 4. Apply it
pnpm exec prisma migrate dev
```

### Adding a Required Field
```bash
# 1. Add field as optional first
# 2. Create migration, apply it
pnpm exec prisma migrate dev --name add_field_optional

# 3. Populate data for existing rows
# 4. Make field required
# 5. Create another migration
pnpm exec prisma migrate dev --name make_field_required
```

### Renaming a Column (Avoid Data Loss)
```bash
# DON'T: Just rename in schema (will drop and recreate)
# DO: Create a custom migration with ALTER TABLE RENAME

# 1. Create empty migration
pnpm exec prisma migrate dev --name rename_column --create-only

# 2. Edit the SQL file manually:
# ALTER TABLE "MyTable" RENAME COLUMN "oldName" TO "newName";

# 3. Update schema.prisma to match
# 4. Apply migration
pnpm exec prisma migrate dev
```

## Emergency: Already Used `db push`?

If you accidentally used `db push` on production:

```bash
# Option 1: Baseline current state
pnpm exec prisma migrate resolve --applied "$(date +%Y%m%d%H%M%S)_baseline"

# Option 2: Create migration from current state
pnpm exec prisma migrate dev --name baseline_existing_schema
```

## Production Deployment Checklist

- [ ] Migration created with `--create-only`
- [ ] SQL reviewed for data loss
- [ ] Migration tested on copy of production data
- [ ] Backup taken before deployment
- [ ] Migration applied with `migrate deploy` (not `migrate dev`)
- [ ] Migration committed to git

## Quick Reference

```bash
# GOOD ✅
pnpm exec prisma migrate dev --name my_change
pnpm exec prisma migrate deploy

# BAD ❌ - NEVER USE
pnpm exec prisma db push
pnpm exec prisma db push --accept-data-loss
```

---

**Remember:** Migrations are your safety net. Always use them!

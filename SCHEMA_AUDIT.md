# Database Schema Audit Report — March 2026

I have completed a cross-reference audit between your **Local Migrations**, the **TypeScript Types** (Live DB state), and two **Backups**.

---

## 📊 Summary of Findings

| SQL Migration File | Contents | In `types.ts`? | In `context/backup.sql`? | In `D:/.../backup.sql`? | Status |
|---|---|---|---|---|---|
| `20260312040000_geocode_consensus.sql` | `geocode_audit`, `geocode_hitl_queue` | ❌ NO | ✅ YES | ❌ NO | **Unapplied to Live** |
| `20260312000000_api_integration.sql` | `geocoding_service_log` | ❌ NO | ✅ YES | ❌ NO | **Unapplied to Live** |
| `20260306235000_admin_hitl_tables.sql` | `admin_tasks`, `admin_task_logs` | ❌ NO | ✅ YES | ❌ NO | **Unapplied to Live** |
| `20250831012541_security_fixes.sql` | `signature_access_log` | ✅ YES | ✅ YES | ❌ NO | **Applied** |

---

## 🔍 Detailed Analysis

### 1. The Migration Gap (March 2026)
None of the tables or columns created in the last 14 days are present in your `src/integrations/supabase/types.ts`. This confirms they have **not** been applied to the live instance that generated those types.

**Missing Columns in `iebc_offices`:**
- `geocode_verified`, `geocode_verified_at`, `multi_source_confidence`
- `elevation_meters`, `isochrone_15min`, `isochrone_30min`, `isochrone_45min`
- `landmark_normalized`, `landmark_source`, `walking_effort`

### 2. Backup Status
- **`context/backup.sql`**: This is the **most up-to-date** snapshot. It contains every single table and column from the latest migrations. This suggests it was taken from a staging/dev environment where the migrations were successfully applied.
- **`D:/CEKA/ceka v010/CEKA/backup.sql`**: This appears to be a **cutoff backup** from late January 2026. It is missing both the March 2026 changes and some late 2025 security tables (like `signature_access_log`). It also contains many unrelated tables (chat, simulations) suggesting it might be from a broader system dump.

### 3. Verification of Types
The fact that `types.ts` contains `signature_access_log` (August 2025) but misses everything from March 2026 indicates that the database was last "officially" synchronized/pushed in late 2025, and the recent March work has remained purely local or in a detached state.

---

## 🛠️ Recommended Action
To bring your live environment in sync with your codebase and `context/backup.sql`, you must apply the March 2026 migrations to your Supabase project.

1. **Apply Tables**: Run the SQL I provided in the previous message (and the contents of the March migration files).
2. **Update Types**: After applying, run `npx supabase gen types typescript --project-id ftswzvqwxdwgkvfbwfpx > src/integrations/supabase/types.ts` to sync your frontend logic.

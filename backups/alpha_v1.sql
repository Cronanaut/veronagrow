


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'Contains VeronaGrow application data. Verified index coverage for user_id and batch_id FKs on 2025-10-25.';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."apply_inventory_to_batch"("p_inventory_item_id" "uuid", "p_batch_id" "uuid", "p_qty" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_item record;
  v_batch record;
  v_total numeric(12,2);
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_item
    from public.inventory_items
   where id = p_inventory_item_id;

  if v_item is null then
    raise exception 'Inventory item not found';
  end if;
  if v_item.user_id <> v_user then
    raise exception 'Not allowed';
  end if;

  select id, user_id into v_batch
    from public.plant_batches
   where id = p_batch_id;

  if v_batch is null then
    raise exception 'Plant batch not found';
  end if;
  if v_batch.user_id <> v_user then
    raise exception 'Not allowed';
  end if;

  if v_item.qty < p_qty then
    raise exception 'Insufficient stock: available %, requested %', v_item.qty, p_qty;
  end if;

  update public.inventory_items
     set qty = qty - p_qty
   where id = p_inventory_item_id
     and user_id = v_user;

  v_total := round(p_qty * coalesce(v_item.unit_cost, 0), 2);

  insert into public.cost_items (
    user_id, batch_id, inventory_item_id,
    description, qty, unit, unit_cost, total
  ) values (
    v_user, p_batch_id, p_inventory_item_id,
    v_item.name, p_qty, v_item.unit, v_item.unit_cost, v_total
  );
end;
$$;


ALTER FUNCTION "public"."apply_inventory_to_batch"("p_inventory_item_id" "uuid", "p_batch_id" "uuid", "p_qty" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."diary_on_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_old text;
  v_new text;
begin
  -- Only act when stage actually changed (including NULL -> value or value -> NULL)
  if (TG_OP = 'UPDATE') and (coalesce(OLD.stage, '') is distinct from coalesce(NEW.stage, '')) then
    v_old := coalesce(OLD.stage, 'unspecified');
    v_new := coalesce(NEW.stage, 'unspecified');

    -- Insert a concise diary entry
    insert into public.diary_entries (
      plant_batch_id,
      user_id,
      entry_date,
      title,
      content
    )
    values (
      NEW.id,
      NEW.user_id,             -- preserves ownership for RLS
      (now() at time zone 'utc')::date,
      'Stage changed',
      format('Stage changed from "%s" to "%s".', v_old, v_new)
    );
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."diary_on_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ctp_usage_apply"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cost  numeric;
  v_delta numeric;
begin
  if (tg_op = 'INSERT') then
    v_cost  := coalesce(fn_item_effective_unit_cost(NEW.item_id), 0);
    v_delta := coalesce(NEW.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = coalesce(ctp_total, 0) + v_delta
     where id = NEW.plant_batch_id;

    if NEW.item_id is not null then
      perform public.fn_recalc_item_qty(NEW.item_id);
    end if;

    return NEW;

  elsif (tg_op = 'DELETE') then
    v_cost  := coalesce(fn_item_effective_unit_cost(OLD.item_id), 0);
    v_delta := coalesce(OLD.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = greatest(0, coalesce(ctp_total, 0) - v_delta)
     where id = OLD.plant_batch_id;

    if OLD.item_id is not null then
      perform public.fn_recalc_item_qty(OLD.item_id);
    end if;

    return OLD;

  elsif (tg_op = 'UPDATE') then
    v_cost  := coalesce(fn_item_effective_unit_cost(coalesce(OLD.item_id, NEW.item_id)), 0);
    v_delta := coalesce(OLD.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = greatest(0, coalesce(ctp_total, 0) - v_delta)
     where id = OLD.plant_batch_id;

    v_cost  := coalesce(fn_item_effective_unit_cost(NEW.item_id), 0);
    v_delta := coalesce(NEW.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = coalesce(ctp_total, 0) + v_delta
     where id = NEW.plant_batch_id;

    if OLD.item_id is not null then
      perform public.fn_recalc_item_qty(OLD.item_id);
    end if;
    if NEW.item_id is not null then
      perform public.fn_recalc_item_qty(NEW.item_id);
    end if;

    return NEW;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."fn_ctp_usage_apply"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_diary_entries_delete_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.inventory_usage_id is not null then
    delete from public.inventory_item_usages where id = old.inventory_usage_id;
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."fn_diary_entries_delete_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_item_effective_unit_cost"("p_item_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  with latest_lot as (
    select unit_cost
    from public.inventory_item_lots
    where item_id = p_item_id
      and unit_cost is not null
    order by coalesce(received_at, created_at) desc nulls last
    limit 1
  )
  select coalesce(
    (select unit_cost from latest_lot),
    (select unit_cost from public.inventory_items where id = p_item_id),
    0
  );
$$;


ALTER FUNCTION "public"."fn_item_effective_unit_cost"("p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_log_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- Only act when stage actually changes (including NULL <> value)
  if tg_op = 'UPDATE' and (new.stage is distinct from old.stage) then
    insert into public.diary_entries (batch_id, user_id, note, entry_date)
    values (
      new.id,
      new.user_id,
      format('Stage changed: %s → %s',
             coalesce(old.stage, '(none)'),
             coalesce(new.stage, '(none)')
      ),
      current_date
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_log_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_lot_recalc_item_qty"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_item uuid;
begin
  v_item := coalesce(new.item_id, old.item_id);
  if v_item is null then
    return coalesce(new, old);
  end if;

  perform public.fn_recalc_item_qty(v_item);
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."fn_lot_recalc_item_qty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_lot_updates_item_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and (new.unit_cost is distinct from old.unit_cost)) then
    update public.inventory_items
       set unit_cost = new.unit_cost
     where id = new.item_id;
  end if;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."fn_lot_updates_item_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_prevent_delete_persistent_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.is_persistent then
    raise exception 'Persistent inventory items cannot be deleted';
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."fn_prevent_delete_persistent_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recalc_item_qty"("p_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_in            numeric := 0;
  v_out           numeric := 0;
  v_is_persistent boolean := false;
begin
  select coalesce(is_persistent, false)
    into v_is_persistent
  from public.inventory_items
  where id = p_item_id;

  if v_is_persistent then
    -- Persistent items always report infinite stock; leave qty unchanged.
    return;
  end if;

  select coalesce(sum(qty), 0) into v_in
    from public.inventory_item_lots
   where item_id = p_item_id;

  select coalesce(sum(qty), 0) into v_out
    from public.inventory_item_usages
   where item_id = p_item_id;

  update public.inventory_items
     set qty = coalesce(v_in, 0) - coalesce(v_out, 0)
   where id = p_item_id;
end;
$$;


ALTER FUNCTION "public"."fn_recalc_item_qty"("p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_usage_delete_diary"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.diary_entries where inventory_usage_id = old.id;
  return old;
end;
$$;


ALTER FUNCTION "public"."fn_usage_delete_diary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_current_timestamp_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cost_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "unit_cost" numeric(10,2) NOT NULL,
    "qty" numeric(10,2) DEFAULT 1 NOT NULL,
    "occurred_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cost_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diary_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "text" "text",
    "photos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "inventory_usage_id" "uuid"
);


ALTER TABLE "public"."diary_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."environment_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "temp_c" numeric(4,1),
    "rh" numeric(4,1),
    "vpd" numeric(4,2),
    "ph_in" numeric(4,2),
    "ec_in" numeric(6,2),
    "ph_out" numeric(4,2),
    "ec_out" numeric(6,2),
    "ppfd" integer,
    "notes" "text"
);


ALTER TABLE "public"."environment_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_item_lots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "lot_code" "text" NOT NULL,
    "qty" numeric(12,2) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(12,2),
    "received_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_item_lots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_item_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "plant_batch_id" "uuid" NOT NULL,
    "qty" numeric(12,2) NOT NULL,
    "note" "text",
    "used_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_item_usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "unit" "text" NOT NULL,
    "unit_cost" numeric(12,2) DEFAULT 0,
    "qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_persistent" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."labor_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task" "text" NOT NULL,
    "minutes" integer NOT NULL,
    "occurred_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "labor_logs_minutes_check" CHECK (("minutes" >= 0))
);


ALTER TABLE "public"."labor_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plant_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "strain" "text",
    "breeder" "text",
    "genotype" "text",
    "origin" "text",
    "start_date" "date" NOT NULL,
    "stage" "text" DEFAULT 'seedling'::"text" NOT NULL,
    "target_yield_grams" integer,
    "thc_pct" numeric(4,1),
    "cbd_pct" numeric(4,1),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ctp_total" numeric DEFAULT 0 NOT NULL,
    "harvested_at" timestamp with time zone,
    "yield_bud" numeric(12,3),
    "yield_trim" numeric(12,3)
);


ALTER TABLE "public"."plant_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "username" "text",
    "avatar_url" "text",
    "water_cost_per_unit" numeric(10,4) DEFAULT 0.0,
    "electricity_cost_per_kwh" numeric(10,4) DEFAULT 0.0,
    "unit_system" "text" DEFAULT 'metric'::"text",
    "temperature_unit" "text" DEFAULT 'C'::"text",
    "bio" "text",
    CONSTRAINT "profiles_temperature_unit_check" CHECK (("temperature_unit" = ANY (ARRAY['C'::"text", 'F'::"text"]))),
    CONSTRAINT "profiles_unit_system_check" CHECK (("unit_system" = ANY (ARRAY['metric'::"text", 'imperial'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_batch_costs" WITH ("security_invoker"='true') AS
 SELECT "batch_id",
    (COALESCE("sum"(("unit_cost" * "qty")), (0)::numeric))::numeric(12,2) AS "total_cost"
   FROM "public"."cost_items"
  GROUP BY "batch_id";


ALTER VIEW "public"."v_batch_costs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."environment_logs"
    ADD CONSTRAINT "environment_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_item_lots"
    ADD CONSTRAINT "inventory_item_lots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_item_usages"
    ADD CONSTRAINT "inventory_item_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_logs"
    ADD CONSTRAINT "labor_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plant_batches"
    ADD CONSTRAINT "plant_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



CREATE UNIQUE INDEX "diary_entries_inventory_usage_id_key" ON "public"."diary_entries" USING "btree" ("inventory_usage_id") WHERE ("inventory_usage_id" IS NOT NULL);



CREATE INDEX "idx_cost_batch" ON "public"."cost_items" USING "btree" ("batch_id");



CREATE INDEX "idx_cost_created" ON "public"."cost_items" USING "btree" ("created_at");



CREATE INDEX "idx_cost_user" ON "public"."cost_items" USING "btree" ("user_id");



CREATE INDEX "idx_de_batch" ON "public"."diary_entries" USING "btree" ("batch_id");



CREATE INDEX "idx_de_created" ON "public"."diary_entries" USING "btree" ("created_at");



CREATE INDEX "idx_de_user" ON "public"."diary_entries" USING "btree" ("user_id");



CREATE INDEX "idx_diary_entries_batch_date" ON "public"."diary_entries" USING "btree" ("batch_id", "entry_date");



CREATE INDEX "idx_diary_entries_user_date" ON "public"."diary_entries" USING "btree" ("user_id", "entry_date");



CREATE INDEX "idx_environment_logs_batch_id" ON "public"."environment_logs" USING "btree" ("batch_id");



CREATE INDEX "idx_environment_logs_user_id" ON "public"."environment_logs" USING "btree" ("user_id");



CREATE INDEX "idx_inv_name" ON "public"."inventory_items" USING "btree" ("name");



CREATE INDEX "idx_inv_user" ON "public"."inventory_items" USING "btree" ("user_id");



CREATE INDEX "idx_item_lots_item_created" ON "public"."inventory_item_lots" USING "btree" ("item_id", "created_at");



CREATE INDEX "idx_item_usages_batch" ON "public"."inventory_item_usages" USING "btree" ("plant_batch_id");



CREATE INDEX "idx_item_usages_item_used" ON "public"."inventory_item_usages" USING "btree" ("item_id", "used_at");



CREATE INDEX "idx_labor_logs_batch_id" ON "public"."labor_logs" USING "btree" ("batch_id");



CREATE INDEX "idx_labor_logs_user_id" ON "public"."labor_logs" USING "btree" ("user_id");



CREATE INDEX "idx_pb_notes" ON "public"."plant_batches" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("notes", ''::"text")));



CREATE INDEX "idx_pb_start" ON "public"."plant_batches" USING "btree" ("start_date");



CREATE INDEX "idx_pb_user" ON "public"."plant_batches" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ctp_usage_ins_upd_del" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_item_usages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ctp_usage_apply"();



CREATE OR REPLACE TRIGGER "trg_diary_delete_usage" AFTER DELETE ON "public"."diary_entries" FOR EACH ROW EXECUTE FUNCTION "public"."fn_diary_entries_delete_usage"();



CREATE OR REPLACE TRIGGER "trg_diary_on_stage_change" AFTER UPDATE OF "stage" ON "public"."plant_batches" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_stage_change"();



CREATE OR REPLACE TRIGGER "trg_lot_recalc_qty" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_item_lots" FOR EACH ROW EXECUTE FUNCTION "public"."fn_lot_recalc_item_qty"();



CREATE OR REPLACE TRIGGER "trg_lot_updates_item_cost" AFTER INSERT OR UPDATE OF "unit_cost" ON "public"."inventory_item_lots" FOR EACH ROW EXECUTE FUNCTION "public"."fn_lot_updates_item_cost"();



CREATE OR REPLACE TRIGGER "trg_prevent_delete_persistent_item" BEFORE DELETE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."fn_prevent_delete_persistent_item"();



CREATE OR REPLACE TRIGGER "trg_usage_delete_diary" AFTER DELETE ON "public"."inventory_item_usages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_usage_delete_diary"();



ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."plant_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."plant_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_inventory_usage_id_fkey" FOREIGN KEY ("inventory_usage_id") REFERENCES "public"."inventory_item_usages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diary_entries"
    ADD CONSTRAINT "diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."environment_logs"
    ADD CONSTRAINT "environment_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."plant_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."environment_logs"
    ADD CONSTRAINT "environment_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_item_lots"
    ADD CONSTRAINT "inventory_item_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_item_usages"
    ADD CONSTRAINT "inventory_item_usages_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_item_usages"
    ADD CONSTRAINT "inventory_item_usages_plant_batch_id_fkey" FOREIGN KEY ("plant_batch_id") REFERENCES "public"."plant_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."labor_logs"
    ADD CONSTRAINT "labor_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."plant_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."labor_logs"
    ADD CONSTRAINT "labor_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plant_batches"
    ADD CONSTRAINT "plant_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "cost_delete_own" ON "public"."cost_items" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "cost_insert_own" ON "public"."cost_items" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."cost_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_select_own" ON "public"."cost_items" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "cost_update_own" ON "public"."cost_items" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "de_delete_own" ON "public"."diary_entries" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "de_insert_own" ON "public"."diary_entries" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "de_select_own" ON "public"."diary_entries" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "de_update_own" ON "public"."diary_entries" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."diary_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "env_delete_own" ON "public"."environment_logs" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "env_insert_own" ON "public"."environment_logs" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "env_select_own" ON "public"."environment_logs" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "env_update_own" ON "public"."environment_logs" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."environment_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inv_delete_own" ON "public"."inventory_items" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "inv_insert_own" ON "public"."inventory_items" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "inv_select_own" ON "public"."inventory_items" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "inv_update_own" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."inventory_item_lots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_item_usages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "labor_delete_own" ON "public"."labor_logs" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "labor_insert_own" ON "public"."labor_logs" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."labor_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "labor_select_own" ON "public"."labor_logs" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "labor_update_own" ON "public"."labor_logs" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "lots_delete_own" ON "public"."inventory_item_lots" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_lots"."item_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "lots_insert_own" ON "public"."inventory_item_lots" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_lots"."item_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "lots_select_own" ON "public"."inventory_item_lots" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_lots"."item_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "lots_update_own" ON "public"."inventory_item_lots" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_lots"."item_id") AND ("i"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_lots"."item_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "pb_delete_own" ON "public"."plant_batches" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "pb_insert_own" ON "public"."plant_batches" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "pb_select_own" ON "public"."plant_batches" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "pb_update_own" ON "public"."plant_batches" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."plant_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "usage_delete_own" ON "public"."inventory_item_usages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_usages"."item_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "usage_insert_own" ON "public"."inventory_item_usages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_usages"."item_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "usage_select_own" ON "public"."inventory_item_usages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_usages"."item_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "usage_update_own" ON "public"."inventory_item_usages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."inventory_items" "i"
  WHERE (("i"."id" = "inventory_item_usages"."item_id") AND ("i"."user_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."apply_inventory_to_batch"("p_inventory_item_id" "uuid", "p_batch_id" "uuid", "p_qty" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_inventory_to_batch"("p_inventory_item_id" "uuid", "p_batch_id" "uuid", "p_qty" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_inventory_to_batch"("p_inventory_item_id" "uuid", "p_batch_id" "uuid", "p_qty" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."diary_on_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."diary_on_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."diary_on_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ctp_usage_apply"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ctp_usage_apply"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ctp_usage_apply"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_diary_entries_delete_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_diary_entries_delete_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_diary_entries_delete_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_item_effective_unit_cost"("p_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_item_effective_unit_cost"("p_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_item_effective_unit_cost"("p_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_log_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_log_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_log_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_lot_recalc_item_qty"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_lot_recalc_item_qty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_lot_recalc_item_qty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_lot_updates_item_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_lot_updates_item_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_lot_updates_item_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_prevent_delete_persistent_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_prevent_delete_persistent_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_prevent_delete_persistent_item"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalc_item_qty"("p_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalc_item_qty"("p_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalc_item_qty"("p_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_usage_delete_diary"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_usage_delete_diary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_usage_delete_diary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."cost_items" TO "anon";
GRANT ALL ON TABLE "public"."cost_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_items" TO "service_role";



GRANT ALL ON TABLE "public"."diary_entries" TO "anon";
GRANT ALL ON TABLE "public"."diary_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."diary_entries" TO "service_role";



GRANT ALL ON TABLE "public"."environment_logs" TO "anon";
GRANT ALL ON TABLE "public"."environment_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."environment_logs" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_item_lots" TO "anon";
GRANT ALL ON TABLE "public"."inventory_item_lots" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_item_lots" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_item_usages" TO "anon";
GRANT ALL ON TABLE "public"."inventory_item_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_item_usages" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."labor_logs" TO "anon";
GRANT ALL ON TABLE "public"."labor_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."labor_logs" TO "service_role";



GRANT ALL ON TABLE "public"."plant_batches" TO "anon";
GRANT ALL ON TABLE "public"."plant_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."plant_batches" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."v_batch_costs" TO "anon";
GRANT ALL ON TABLE "public"."v_batch_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."v_batch_costs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;

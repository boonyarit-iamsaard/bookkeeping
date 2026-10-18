-- The backup manifest: when the snapshot was taken, the server version, and
-- for every table in `public` its row count and an MD5 of its rows in
-- primary-key order. The backup job runs it inside the transaction whose
-- snapshot pg_dump reads; the restore drill runs it against the restored
-- database and compares the tables.

-- Row text depends on these settings, so pin them for a stable checksum.
SET TimeZone = 'UTC';
SET DateStyle = 'ISO, YMD';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 1;
SET bytea_output = 'hex';

WITH user_tables AS (
  SELECT
    c.relname AS table_name,
    -- A table without a primary key falls back to ordering by its row text,
    -- which is still deterministic.
    coalesce(
      (
        SELECT string_agg(format('r.%I', a.attname), ', ' ORDER BY k.position)
        FROM pg_index AS i
        CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
        JOIN pg_attribute AS a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
        WHERE i.indrelid = c.oid AND i.indisprimary
      ),
      'r::text'
    ) AS order_by
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
),
table_results AS (
  -- query_to_xml runs a query built per table inside this one statement.
  SELECT
    table_name,
    query_to_xml(
      format(
        $$SELECT count(*) AS row_count,
                 md5(coalesce(string_agg(r::text, E'\n' ORDER BY %s), '')) AS checksum
          FROM public.%I AS r$$,
        order_by,
        table_name
      ),
      false,
      true,
      ''
    ) AS result
  FROM user_tables
)
SELECT json_build_object(
  'dumpedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'serverVersion', current_setting('server_version'),
  'tables', coalesce(
    (
      SELECT json_object_agg(
        table_name,
        json_build_object(
          'rows', (xpath('/row/row_count/text()', result))[1]::text::bigint,
          'checksum', (xpath('/row/checksum/text()', result))[1]::text
        )
        ORDER BY table_name
      )
      FROM table_results
    ),
    '{}'::json
  )
);

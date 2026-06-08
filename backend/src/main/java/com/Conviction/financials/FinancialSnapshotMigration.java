package com.conviction.financials;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Drops the legacy UNIQUE(symbol, fiscal_year) constraint from financial_snapshots
 * so that annual and quarterly rows for the same symbol/date can coexist.
 *
 * Hibernate ddl-auto=update adds new constraints but cannot drop old ones, so this
 * runs once at startup and is a no-op after the constraint is gone.
 */
@Component
public class FinancialSnapshotMigration {

    private static final Logger log = LoggerFactory.getLogger(FinancialSnapshotMigration.class);

    private final JdbcTemplate jdbc;

    public FinancialSnapshotMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void dropLegacyTwoColumnConstraint() {
        // Find any unique constraint on financial_snapshots that covers exactly
        // 2 columns: symbol + fiscal_year (the old constraint before period was added).
        // The 3-column constraint (symbol, fiscal_year, period) covers 3 columns — skip it.
        String findSql = """
                SELECT kcu.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                   AND tc.table_schema   = kcu.table_schema
                WHERE tc.table_name      = 'financial_snapshots'
                  AND tc.constraint_type = 'UNIQUE'
                GROUP BY kcu.constraint_name
                HAVING COUNT(*)  = 2
                   AND bool_and(kcu.column_name IN ('symbol', 'fiscal_year'))
                """;

        List<String> names = jdbc.queryForList(findSql, String.class);
        for (String name : names) {
            log.info("Dropping legacy unique constraint '{}' from financial_snapshots", name);
            jdbc.execute("ALTER TABLE financial_snapshots DROP CONSTRAINT IF EXISTS \"" + name + "\"");
        }

        if (names.isEmpty()) {
            log.debug("No legacy 2-column unique constraint found on financial_snapshots — nothing to do");
        }
    }
}

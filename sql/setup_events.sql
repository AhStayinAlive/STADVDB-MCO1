-- Manual Event Setup for Automated Maintenance
-- Run this script after all other scripts are completed

USE gosales_dw;

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;

-- Create event for daily optimization
CREATE EVENT IF NOT EXISTS daily_optimization
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
    CALL OptimizeDataWarehouse();

-- Create event for weekly aggregation refresh
CREATE EVENT IF NOT EXISTS weekly_aggregation_refresh
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP
DO
    CALL RefreshAllAggregations();

-- Verify events were created
SELECT 
    EVENT_NAME,
    EVENT_DEFINITION,
    INTERVAL_VALUE,
    INTERVAL_FIELD,
    STATUS
FROM INFORMATION_SCHEMA.EVENTS 
WHERE EVENT_SCHEMA = 'gosales_dw';

SELECT 'Events created successfully' as status;


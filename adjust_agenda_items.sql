-- Function to adjust agenda items when event time increment or start time changes
-- This handles both increment changes and start time changes in a single function
-- Updates the event AND adjusts agenda items in a single transaction

CREATE OR REPLACE FUNCTION adjust_agenda_items_for_event(
    p_event_id UUID,
    p_new_increment_minutes INTEGER DEFAULT NULL,
    p_new_start_time TIME DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_event_record RECORD;
    v_agenda_item RECORD;
    v_current_start_time TIME;
    v_current_end_time TIME;
    v_next_start_time TIME;
    v_item_duration_minutes INTEGER;
    v_adjusted_count INTEGER := 0;
    v_current_date DATE;
    v_event_start_time TIME;
    v_event_end_time TIME;
    v_increment_minutes INTEGER;
    v_result TEXT;
BEGIN
    -- Get event details
    SELECT 
        start_time,
        end_time,
        time_increment_minutes,
        start_date,
        end_date
    INTO v_event_record
    FROM events 
    WHERE id = p_event_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found: %', p_event_id;
    END IF;
    
    -- Use provided values or existing values
    v_increment_minutes := COALESCE(p_new_increment_minutes, v_event_record.time_increment_minutes);
    v_event_start_time := COALESCE(p_new_start_time, v_event_record.start_time);
    v_event_end_time := v_event_record.end_time;
    
    -- Validate increment
    IF v_increment_minutes NOT IN (1, 5, 10, 15, 30, 60) THEN
        RAISE EXCEPTION 'Invalid time increment: %. Must be 1, 5, 10, 15, 30, or 60 minutes', v_increment_minutes;
    END IF;
    
    -- Update the event with new values (if provided)
    UPDATE events 
    SET 
        time_increment_minutes = COALESCE(p_new_increment_minutes, time_increment_minutes),
        start_time = COALESCE(p_new_start_time, start_time)
    WHERE id = p_event_id;
    
    -- Process each day of the event
    FOR v_current_date IN 
        SELECT generate_series(
            v_event_record.start_date::date, 
            v_event_record.end_date::date, 
            '1 day'::interval
        )::date
    LOOP
        -- Get all agenda items for this day, ordered by current start time
        FOR v_agenda_item IN 
            SELECT 
                id,
                start_time,
                end_time,
                duration_minutes
            FROM agenda_items 
            WHERE event_id = p_event_id 
                AND day_index = EXTRACT(DOY FROM v_current_date) - EXTRACT(DOY FROM v_event_record.start_date::date)
            ORDER BY start_time
        LOOP
            -- Calculate item duration
            v_item_duration_minutes := v_agenda_item.duration_minutes;
            
            -- For first item of the day, start at event start time (or next valid increment)
            IF v_current_start_time IS NULL THEN
                v_current_start_time := v_event_start_time;
            END IF;
            
            -- Snap start time to valid increment boundary
            v_current_start_time := snap_time_to_increment(v_current_start_time, v_increment_minutes);
            
            -- Calculate end time based on duration
            v_current_end_time := v_current_start_time + (v_item_duration_minutes || ' minutes')::interval;
            
            -- Snap end time to valid increment boundary
            v_current_end_time := snap_time_to_increment(v_current_end_time, v_increment_minutes);
            
            -- Check if we're still within event bounds
            IF v_current_start_time >= v_event_end_time THEN
                -- Skip this item if it would start after event end time
                CONTINUE;
            END IF;
            
            -- Update the agenda item
            UPDATE agenda_items 
            SET 
                start_time = v_current_start_time::text,
                end_time = v_current_end_time::text
            WHERE id = v_agenda_item.id;
            
            v_adjusted_count := v_adjusted_count + 1;
            
            -- Set next start time to current end time
            v_next_start_time := v_current_end_time;
            v_current_start_time := v_next_start_time;
        END LOOP;
        
            -- Reset for next day
    v_current_start_time := NULL;
END LOOP;
    
-- Return success message with count
v_result := 'SUCCESS: ' || v_adjusted_count || ' agenda items were adjusted.';
RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback will happen automatically due to exception
        v_result := 'ERROR: ' || SQLERRM;
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to snap time to valid increment boundary
CREATE OR REPLACE FUNCTION snap_time_to_increment(
    p_time TIME,
    p_increment_minutes INTEGER
) RETURNS TIME AS $$
DECLARE
    v_total_minutes INTEGER;
    v_snapped_minutes INTEGER;
BEGIN
    -- Convert time to total minutes since midnight
    v_total_minutes := EXTRACT(HOUR FROM p_time) * 60 + EXTRACT(MINUTE FROM p_time);
    
    -- Snap to nearest increment
    v_snapped_minutes := (v_total_minutes / p_increment_minutes) * p_increment_minutes;
    
    -- If we're not exactly on an increment boundary, round up
    IF v_total_minutes % p_increment_minutes != 0 THEN
        v_snapped_minutes := v_snapped_minutes + p_increment_minutes;
    END IF;
    
    -- Convert back to time
    RETURN (v_snapped_minutes / 60)::text || ':' || 
           LPAD((v_snapped_minutes % 60)::text, 2, '0') || ':00';
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT adjust_agenda_items_for_event('your-event-id', 30, NULL);  -- Change increment to 30 minutes
-- SELECT adjust_agenda_items_for_event('your-event-id', NULL, '09:30');  -- Change start time to 9:30
-- SELECT adjust_agenda_items_for_event('your-event-id', 15, '10:00');  -- Change both increment and start time

-- Usage in application:
-- BEGIN;
-- SELECT adjust_agenda_items_for_event('your-event-id', 30, NULL);
-- -- Check if result starts with 'SUCCESS:' or 'ERROR:'
-- COMMIT; -- or ROLLBACK based on result 
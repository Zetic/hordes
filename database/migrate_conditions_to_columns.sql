-- Migration to replace JSON conditions with individual boolean columns
-- This completely removes JSON/JSONB usage from the conditions system

-- First, add the new boolean columns for each PlayerCondition
DO $$
BEGIN
    -- Add boolean columns for each condition type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'condition_healthy') THEN
        ALTER TABLE players ADD COLUMN condition_healthy BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'condition_wounded') THEN
        ALTER TABLE players ADD COLUMN condition_wounded BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'condition_fed') THEN
        ALTER TABLE players ADD COLUMN condition_fed BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'condition_refreshed') THEN
        ALTER TABLE players ADD COLUMN condition_refreshed BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'condition_thirsty') THEN
        ALTER TABLE players ADD COLUMN condition_thirsty BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'condition_dehydrated') THEN
        ALTER TABLE players ADD COLUMN condition_dehydrated BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'condition_exhausted') THEN
        ALTER TABLE players ADD COLUMN condition_exhausted BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Migrate existing JSON data to boolean columns
-- This parses the existing JSON and sets the appropriate boolean flags
UPDATE players SET
    condition_healthy = (
        CASE 
            WHEN conditions IS NULL OR conditions = '' THEN true
            WHEN conditions::text LIKE '%"healthy"%' THEN true 
            ELSE false 
        END
    ),
    condition_wounded = (
        CASE 
            WHEN conditions::text LIKE '%"wounded"%' THEN true 
            ELSE false 
        END
    ),
    condition_fed = (
        CASE 
            WHEN conditions::text LIKE '%"fed"%' THEN true 
            ELSE false 
        END
    ),
    condition_refreshed = (
        CASE 
            WHEN conditions::text LIKE '%"refreshed"%' THEN true 
            ELSE false 
        END
    ),
    condition_thirsty = (
        CASE 
            WHEN conditions::text LIKE '%"thirsty"%' THEN true 
            ELSE false 
        END
    ),
    condition_dehydrated = (
        CASE 
            WHEN conditions::text LIKE '%"dehydrated"%' THEN true 
            ELSE false 
        END
    ),
    condition_exhausted = (
        CASE 
            WHEN conditions::text LIKE '%"exhausted"%' THEN true 
            ELSE false 
        END
    );

-- Add comments to document the new structure
COMMENT ON COLUMN players.condition_healthy IS 'Player is in healthy condition (replaces JSON conditions array)';
COMMENT ON COLUMN players.condition_wounded IS 'Player is wounded (replaces JSON conditions array)';
COMMENT ON COLUMN players.condition_fed IS 'Player is fed (replaces JSON conditions array)';
COMMENT ON COLUMN players.condition_refreshed IS 'Player is refreshed (replaces JSON conditions array)';
COMMENT ON COLUMN players.condition_thirsty IS 'Player is thirsty (replaces JSON conditions array)';
COMMENT ON COLUMN players.condition_dehydrated IS 'Player is dehydrated (replaces JSON conditions array)';
COMMENT ON COLUMN players.condition_exhausted IS 'Player is exhausted (replaces JSON conditions array)';

-- Create indexes for efficient querying of conditions
CREATE INDEX IF NOT EXISTS idx_players_condition_healthy ON players(condition_healthy);
CREATE INDEX IF NOT EXISTS idx_players_condition_wounded ON players(condition_wounded);
CREATE INDEX IF NOT EXISTS idx_players_condition_fed ON players(condition_fed);
CREATE INDEX IF NOT EXISTS idx_players_condition_refreshed ON players(condition_refreshed);
CREATE INDEX IF NOT EXISTS idx_players_condition_thirsty ON players(condition_thirsty);
CREATE INDEX IF NOT EXISTS idx_players_condition_dehydrated ON players(condition_dehydrated);
CREATE INDEX IF NOT EXISTS idx_players_condition_exhausted ON players(condition_exhausted);

-- Verify the migration worked by checking a few records
-- (This is just for verification, not part of the migration)
DO $$
DECLARE
    rec RECORD;
    condition_count INTEGER;
BEGIN
    -- Count how many records have been migrated
    SELECT COUNT(*) INTO condition_count 
    FROM players 
    WHERE condition_healthy IS NOT NULL;
    
    RAISE NOTICE 'Migration completed: % player records updated with new condition columns', condition_count;
    
    -- Show a sample of migrated data for verification
    FOR rec IN 
        SELECT discord_id, conditions, condition_healthy, condition_wounded, condition_fed 
        FROM players 
        LIMIT 3
    LOOP
        RAISE NOTICE 'Player %: old=%, healthy=%, wounded=%, fed=%', 
            rec.discord_id, rec.conditions, rec.condition_healthy, rec.condition_wounded, rec.condition_fed;
    END LOOP;
END $$;

-- Note: The old 'conditions' column will be dropped in a separate step after verifying the migration
-- DROP COLUMN conditions; -- Will be done after verification
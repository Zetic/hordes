-- DIE2NITE Discord Bot Database Setup
-- Run this script to create the necessary database tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  health INTEGER DEFAULT 100,
  max_health INTEGER DEFAULT 100,
  status VARCHAR(10) DEFAULT 'healthy',
  action_points INTEGER DEFAULT 10,
  max_action_points INTEGER DEFAULT 10,
  water INTEGER DEFAULT 3,
  is_alive BOOLEAN DEFAULT true,
  location VARCHAR(50) DEFAULT 'city',
  last_action_time TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  defense_level INTEGER DEFAULT 0,
  population INTEGER DEFAULT 0,
  day INTEGER DEFAULT 1,
  game_phase VARCHAR(50) DEFAULT 'play_mode',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Buildings table
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  level INTEGER DEFAULT 1,
  health INTEGER DEFAULT 100,
  max_health INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Area inventories table (for dropped items in exploration areas)
CREATE TABLE IF NOT EXISTS area_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location VARCHAR(50) NOT NULL,
  item_id UUID REFERENCES items(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bank inventories table (for town bank)
CREATE TABLE IF NOT EXISTS bank_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Explored tiles table (for persistent map exploration)
CREATE TABLE IF NOT EXISTS explored_tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(x, y)
);

-- Zombies table (for zombie entities on the map)
CREATE TABLE IF NOT EXISTS zombies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(x, y)
);

-- Zone contests table (for zone contesting system)
CREATE TABLE IF NOT EXISTS zone_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'uncontested', -- 'uncontested', 'contested', 'temporarily_uncontested'
  human_cp INTEGER NOT NULL DEFAULT 0, -- Human control points
  zombie_cp INTEGER NOT NULL DEFAULT 0, -- Zombie control points
  temp_uncontested_until TIMESTAMP NULL, -- For 30-minute timer in temporarily uncontested status
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(x, y)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);
CREATE INDEX IF NOT EXISTS idx_players_alive ON players(is_alive);
CREATE INDEX IF NOT EXISTS idx_players_coordinates ON players(x, y);
CREATE INDEX IF NOT EXISTS idx_inventory_player_id ON inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_buildings_city_id ON buildings(city_id);
CREATE INDEX IF NOT EXISTS idx_area_inventories_location ON area_inventories(location);
CREATE INDEX IF NOT EXISTS idx_bank_inventories_city_id ON bank_inventories(city_id);
CREATE INDEX IF NOT EXISTS idx_explored_tiles_coords ON explored_tiles(x, y);
CREATE INDEX IF NOT EXISTS idx_zombies_coords ON zombies(x, y);
CREATE INDEX IF NOT EXISTS idx_zone_contests_coords ON zone_contests(x, y);
CREATE INDEX IF NOT EXISTS idx_zone_contests_status ON zone_contests(status);
CREATE INDEX IF NOT EXISTS idx_zone_contests_temp_timer ON zone_contests(temp_uncontested_until);

-- Insert default city if it doesn't exist
INSERT INTO cities (name, day, game_phase)
SELECT 'Sanctuary', 1, 'play_mode'
WHERE NOT EXISTS (SELECT 1 FROM cities);

-- Add grid coordinates and gate status migration
DO $$
BEGIN
    -- Add status column migration for existing data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'status') THEN
        ALTER TABLE players ADD COLUMN status VARCHAR(10) DEFAULT 'healthy';
        
        -- Migrate existing data: set status based on current health and is_alive
        UPDATE players SET status = CASE 
            WHEN NOT is_alive THEN 'dead'
            WHEN health < max_health THEN 'wounded'
            ELSE 'healthy'
        END;
    END IF;

    -- Add coordinates to players table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'x') THEN
        ALTER TABLE players ADD COLUMN x INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'y') THEN
        ALTER TABLE players ADD COLUMN y INTEGER;
    END IF;
    
    -- Add gate status to cities table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cities' AND column_name = 'gate_open') THEN
        ALTER TABLE cities ADD COLUMN gate_open BOOLEAN DEFAULT true;
    END IF;

    -- Add new item properties for object system
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'category') THEN
        ALTER TABLE items ADD COLUMN category VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'sub_category') THEN
        ALTER TABLE items ADD COLUMN sub_category VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'kill_chance') THEN
        ALTER TABLE items ADD COLUMN kill_chance INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'break_chance') THEN
        ALTER TABLE items ADD COLUMN break_chance INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'kill_count') THEN
        ALTER TABLE items ADD COLUMN kill_count INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'on_break') THEN
        ALTER TABLE items ADD COLUMN on_break VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'broken') THEN
        ALTER TABLE items ADD COLUMN broken BOOLEAN DEFAULT false;
    END IF;
END $$;

COMMENT ON TABLE players IS 'Stores player data and stats';
COMMENT ON TABLE cities IS 'Stores city/town information';
COMMENT ON TABLE items IS 'Stores item definitions';
COMMENT ON TABLE inventory IS 'Stores player inventories';
COMMENT ON TABLE buildings IS 'Stores city buildings and defenses';
COMMENT ON TABLE area_inventories IS 'Stores items dropped in exploration areas';
COMMENT ON TABLE bank_inventories IS 'Stores items in the town bank';
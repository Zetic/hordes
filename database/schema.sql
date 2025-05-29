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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);
CREATE INDEX IF NOT EXISTS idx_players_alive ON players(is_alive);
CREATE INDEX IF NOT EXISTS idx_inventory_player_id ON inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_buildings_city_id ON buildings(city_id);
CREATE INDEX IF NOT EXISTS idx_area_inventories_location ON area_inventories(location);
CREATE INDEX IF NOT EXISTS idx_bank_inventories_city_id ON bank_inventories(city_id);

-- Insert default city if it doesn't exist
INSERT INTO cities (name, day, game_phase)
SELECT 'Sanctuary', 1, 'play_mode'
WHERE NOT EXISTS (SELECT 1 FROM cities);

-- Add status column migration for existing data
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'status') THEN
        ALTER TABLE players ADD COLUMN status VARCHAR(10) DEFAULT 'healthy';
        
        -- Migrate existing data: set status based on current health and is_alive
        UPDATE players SET status = CASE 
            WHEN NOT is_alive THEN 'dead'
            WHEN health < max_health THEN 'wounded'
            ELSE 'healthy'
        END;
    END IF;
END $$;

COMMENT ON TABLE players IS 'Stores player data and stats';
COMMENT ON TABLE cities IS 'Stores city/town information';
COMMENT ON TABLE items IS 'Stores item definitions';
COMMENT ON TABLE inventory IS 'Stores player inventories';
COMMENT ON TABLE buildings IS 'Stores city buildings and defenses';
COMMENT ON TABLE area_inventories IS 'Stores items dropped in exploration areas';
COMMENT ON TABLE bank_inventories IS 'Stores items in the town bank';
-- Migration for new building system
-- This adds the new construction project system and well water tracking

-- Construction projects table (for ongoing building projects)
CREATE TABLE IF NOT EXISTS construction_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  project_type VARCHAR(50) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  sub_category VARCHAR(50) NOT NULL,
  total_ap_required INTEGER NOT NULL,
  current_ap_progress INTEGER DEFAULT 0,
  is_visitable BOOLEAN DEFAULT false,
  defense_bonus INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Construction project material requirements
CREATE TABLE IF NOT EXISTS construction_project_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  required_quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Well water tracking
CREATE TABLE IF NOT EXISTS well_water (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  current_water INTEGER NOT NULL DEFAULT 135, -- Start with random 90-180, using middle value
  max_water INTEGER DEFAULT 180,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(city_id)
);

-- Daily water ration tracking
CREATE TABLE IF NOT EXISTS daily_water_rations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  rations_taken INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, city_id, date)
);

-- Horde size estimates (for watch tower visits)
CREATE TABLE IF NOT EXISTS horde_size_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  estimate_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, city_id, estimate_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_construction_projects_city_id ON construction_projects(city_id);
CREATE INDEX IF NOT EXISTS idx_construction_projects_completed ON construction_projects(is_completed);
CREATE INDEX IF NOT EXISTS idx_construction_project_materials_project_id ON construction_project_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_well_water_city_id ON well_water(city_id);
CREATE INDEX IF NOT EXISTS idx_daily_water_rations_player_date ON daily_water_rations(player_id, date);
CREATE INDEX IF NOT EXISTS idx_horde_size_estimates_city_date ON horde_size_estimates(city_id, estimate_date);

-- Update building types to support new categories 
DO $$
BEGIN
    -- Add category and subcategory to buildings table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'category') THEN
        ALTER TABLE buildings ADD COLUMN category VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'sub_category') THEN
        ALTER TABLE buildings ADD COLUMN sub_category VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'is_visitable') THEN
        ALTER TABLE buildings ADD COLUMN is_visitable BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'defense_bonus') THEN
        ALTER TABLE buildings ADD COLUMN defense_bonus INTEGER DEFAULT 0;
    END IF;
END $$;
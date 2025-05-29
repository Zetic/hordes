import { DatabaseService } from '../services/database';
import { BankService } from '../models/bank';
import { AreaInventoryService } from '../models/areaInventory';

describe('Drop and Bank Fix', () => {
  describe('Database Schema', () => {
    test('should include bank_inventories table creation', () => {
      // Read the database service source file to verify the table creation statements exist
      const fs = require('fs');
      const path = require('path');
      const databaseServicePath = path.join(__dirname, '..', 'services', 'database.ts');
      const databaseServiceContent = fs.readFileSync(databaseServicePath, 'utf8');
      
      // Check that bank_inventories table creation is present
      expect(databaseServiceContent).toContain('CREATE TABLE IF NOT EXISTS bank_inventories');
      expect(databaseServiceContent).toContain('city_id UUID REFERENCES cities(id) ON DELETE CASCADE');
      expect(databaseServiceContent).toContain('item_id UUID REFERENCES items(id)');
    });

    test('should include area_inventories table creation', () => {
      const fs = require('fs');
      const path = require('path');
      const databaseServicePath = path.join(__dirname, '..', 'services', 'database.ts');
      const databaseServiceContent = fs.readFileSync(databaseServicePath, 'utf8');
      
      // Check that area_inventories table creation is present
      expect(databaseServiceContent).toContain('CREATE TABLE IF NOT EXISTS area_inventories');
      expect(databaseServiceContent).toContain('location VARCHAR(50) NOT NULL');
      expect(databaseServiceContent).toContain('item_id UUID REFERENCES items(id)');
    });
  });

  describe('Service Dependencies', () => {
    test('should have BankService class available', () => {
      const bankService = new BankService();
      expect(bankService).toBeDefined();
      expect(typeof bankService.depositItem).toBe('function');
      expect(typeof bankService.withdrawItem).toBe('function');
      expect(typeof bankService.getBankInventory).toBe('function');
    });

    test('should have AreaInventoryService class available', () => {
      const areaInventoryService = new AreaInventoryService();
      expect(areaInventoryService).toBeDefined();
      expect(typeof areaInventoryService.addItemToArea).toBe('function');
      expect(typeof areaInventoryService.removeItemFromArea).toBe('function');
      expect(typeof areaInventoryService.getAreaInventory).toBe('function');
    });

    test('should have drop command properly structured', () => {
      const dropCommand = require('../commands/drop');
      expect(dropCommand).toHaveProperty('data');
      expect(dropCommand).toHaveProperty('execute');
      expect(typeof dropCommand.execute).toBe('function');
    });

    test('should have bank command properly structured', () => {
      const bankCommand = require('../commands/bank');
      expect(bankCommand).toHaveProperty('data');
      expect(bankCommand).toHaveProperty('execute');
      expect(typeof bankCommand.execute).toBe('function');
    });
  });

  describe('Command Integration', () => {
    test('drop command should import required services', () => {
      const fs = require('fs');
      const path = require('path');
      const dropCommandPath = path.join(__dirname, '..', 'commands', 'drop.ts');
      const dropCommandContent = fs.readFileSync(dropCommandPath, 'utf8');
      
      // Check that all required services are imported
      expect(dropCommandContent).toContain('import { BankService }');
      expect(dropCommandContent).toContain('import { AreaInventoryService }');
      expect(dropCommandContent).toContain('bankService.depositItem');
      expect(dropCommandContent).toContain('areaInventoryService.addItemToArea');
    });

    test('bank command should import required services', () => {
      const fs = require('fs');
      const path = require('path');
      const bankCommandPath = path.join(__dirname, '..', 'commands', 'bank.ts');
      const bankCommandContent = fs.readFileSync(bankCommandPath, 'utf8');
      
      // Check that BankService is properly imported and used
      expect(bankCommandContent).toContain('import { BankService }');
      expect(bankCommandContent).toContain('bankService.depositItem');
      expect(bankCommandContent).toContain('bankService.withdrawItem');
    });
  });
});
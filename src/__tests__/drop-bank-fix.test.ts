import { DatabaseService } from '../services/database';
import { BankService } from '../models/bank';
import { AreaInventoryService } from '../models/areaInventory';

describe('Drop and Bank Fix', () => {
  describe('Database Schema', () => {
    test('should verify schema initialization has been removed from database service', () => {
      // Schema initialization has been removed from database.ts - managed externally now
      const fs = require('fs');
      const path = require('path');
      const databaseServicePath = path.join(__dirname, '..', 'services', 'database.ts');
      const databaseServiceContent = fs.readFileSync(databaseServicePath, 'utf8');
      
      // Verify that schema initialization is no longer present
      expect(databaseServiceContent).not.toContain('CREATE TABLE IF NOT EXISTS bank_inventories');
      expect(databaseServiceContent).not.toContain('CREATE TABLE IF NOT EXISTS area_inventories');
      expect(databaseServiceContent).toContain('Schema initialization removed - database schema is managed externally');
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
  });
});
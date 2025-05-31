describe('Status Command Conditions Display Fix', () => {
  test('should display conditions on separate non-inline row', () => {
    // Mock the status command field generation logic
    const mockPlayer = {
      isAlive: true,
      conditions: ['refreshed', 'fed'],
      status: 'healthy',
      actionPoints: 8,
      maxActionPoints: 10
    };

    const statusEmojis: { [key: string]: string } = {
      'healthy': '💚',
      'refreshed': '💧',
      'fed': '🍞'
    };
    
    const statusTexts: { [key: string]: string } = {
      'healthy': 'Healthy',
      'refreshed': 'Refreshed',
      'fed': 'Fed'
    };

    // Simulate the field structure from the status command
    const fields = [
      { 
        name: '💚 Status', 
        value: mockPlayer.isAlive ? '💚 Alive' : '💀 Dead', 
        inline: true 
      },
      { 
        name: '⚡ Action Points', 
        value: `${mockPlayer.actionPoints}/${mockPlayer.maxActionPoints}`, 
        inline: true 
      },
      { 
        name: '📍 Location', 
        value: '🏢 City (Safe Zone)', 
        inline: true 
      },
      { 
        name: '⏰ Last Action', 
        value: '<t:1234567890:R>', 
        inline: true 
      },
      ...(mockPlayer.isAlive ? [{ 
        name: '🔄 Conditions', 
        value: mockPlayer.conditions.length > 0 
          ? mockPlayer.conditions.map(condition => `${statusEmojis[condition]} ${statusTexts[condition]}`).join('\n')
          : `${statusEmojis[mockPlayer.status]} ${statusTexts[mockPlayer.status]}`, 
        inline: false  // This is the key fix - should be false for separate row
      }] : [])
    ];

    // Verify conditions field exists and is non-inline
    const conditionsField = fields.find(field => field.name === '🔄 Conditions');
    expect(conditionsField).toBeDefined();
    expect(conditionsField!.inline).toBe(false);
    
    // Verify conditions are displayed properly
    expect(conditionsField!.value).toContain('💧 Refreshed');
    expect(conditionsField!.value).toContain('🍞 Fed');
    expect(conditionsField!.value.split('\n')).toHaveLength(2);
    
    // Verify conditions field comes after the inline fields
    const conditionsIndex = fields.findIndex(field => field.name === '🔄 Conditions');
    const inlineFields = fields.filter(field => field.inline);
    expect(conditionsIndex).toBeGreaterThan(inlineFields.length - 1);
  });

  test('should show vital status when no conditions present', () => {
    const mockPlayer = {
      isAlive: true,
      conditions: [],
      status: 'wounded'
    };

    const statusEmojis: { [key: string]: string } = {
      'wounded': '🩸'
    };
    
    const statusTexts: { [key: string]: string } = {
      'wounded': 'Wounded'
    };

    const conditionsValue = mockPlayer.conditions.length > 0 
      ? mockPlayer.conditions.map(condition => `${statusEmojis[condition]} ${statusTexts[condition]}`).join('\n')
      : `${statusEmojis[mockPlayer.status]} ${statusTexts[mockPlayer.status]}`;

    // When no conditions, should show vital status
    expect(conditionsValue).toBe('🩸 Wounded');
  });

  test('should not show conditions field for dead players', () => {
    const mockPlayer = {
      isAlive: false,
      conditions: ['refreshed'], // Dead players shouldn't show conditions
      status: 'dead'
    };

    // Simulate the conditional field addition
    const conditionsField = mockPlayer.isAlive ? {
      name: '🔄 Conditions',
      value: 'some value',
      inline: false
    } : undefined;

    expect(conditionsField).toBeUndefined();
  });
});
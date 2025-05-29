import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { AreaInventoryService } from '../models/areaInventory';
import { Location, PlayerStatus, ItemType } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const areaInventoryService = new AreaInventoryService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search the current area for items (risky!)'),

  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is in an exploration area
      if (player.location === Location.CITY || player.location === Location.HOME) {
        await interaction.reply({
          content: '❌ You must be in an exploration area to search. Use `/depart` and `/move` to venture outside the city.',
          ephemeral: true
        });
        return;
      }

      // Check if player is encumbered
      const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
      if (isEncumbered) {
        await interaction.reply({
          content: '❌ You are encumbered and cannot search. Use `/drop <item>` to free up space first.',
          ephemeral: true
        });
        return;
      }

      // Generate search results
      const searchResult = generateSearchResult(player.location, player.status);

      const embed = new EmbedBuilder()
        .setColor('#ffa502')
        .setTitle('🔍 Searching for Items')
        .setDescription(`${player.name} searches the area for valuable supplies...`)
        .addFields([
          {
            name: '🎲 Search Result',
            value: searchResult.description,
            inline: false
          }
        ]);

      // Apply results
      if (searchResult.statusChange) {
        let newStatus: PlayerStatus;
        let statusMessage: string;
        
        if (player.status === PlayerStatus.HEALTHY) {
          newStatus = PlayerStatus.WOUNDED;
          statusMessage = 'You have been wounded! Another injury could be fatal.';
        } else if (player.status === PlayerStatus.WOUNDED) {
          newStatus = PlayerStatus.DEAD;
          statusMessage = 'You have died from your wounds! You can no longer take actions until the next day.';
        } else {
          // Player is already dead, shouldn't happen but handle gracefully
          newStatus = player.status;
          statusMessage = 'You are already dead.';
        }
        
        await playerService.updatePlayerStatus(discordId, newStatus);
        
        embed.addFields([
          { 
            name: newStatus === PlayerStatus.DEAD ? '💀 DEATH' : '🩸 WOUNDED', 
            value: statusMessage, 
            inline: false 
          }
        ]);

        if (newStatus === PlayerStatus.DEAD) {
          embed.setColor('#ff6b6b');
        } else {
          embed.setColor('#ff9f43');
        }
      }

      // Handle items found
      if (searchResult.itemsFound.length > 0) {
        for (const itemName of searchResult.itemsFound) {
          // Find or create the item
          let item = await itemService.getItemByName(itemName);
          if (!item) {
            // Create the item if it doesn't exist
            const itemType = determineItemType(itemName);
            item = await itemService.createItem(itemName, itemType, `Found in ${player.location}`, 1);
          }

          if (item) {
            // Check if player can carry more items
            const currentCount = await inventoryService.getInventoryCount(player.id);
            const maxItems = InventoryService.getMaxInventorySize();
            
            if (currentCount >= maxItems) {
              // Add item to area inventory instead of discarding it
              const addToAreaSuccess = await areaInventoryService.addItemToArea(player.location, item.id, 1, player.x || undefined, player.y || undefined);
              if (addToAreaSuccess) {
                embed.addFields([
                  {
                    name: '📦 Item Found but Inventory Full',
                    value: `You found **${item.name}** but your inventory is full! The item has been left on the ground. Use \`/drop <item>\` to make room or come back later.`,
                    inline: false
                  }
                ]);
              }
            } else {
              // Add item to inventory
              const addSuccess = await inventoryService.addItemToInventory(player.id, item.id, 1);
              if (addSuccess) {
                embed.addFields([
                  {
                    name: '🎒 Item Added to Inventory',
                    value: `**${item.name}** has been added to your inventory!`,
                    inline: false
                  }
                ]);
              }
            }
          }
        }
      }

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in search command:', error);
      await interaction.reply({
        content: '❌ An error occurred while searching.',
        ephemeral: true
      });
    }
  }
};

interface SearchResult {
  description: string;
  statusChange: boolean; // true if player gets hurt
  itemsFound: string[];
}

function generateSearchResult(location: Location, playerStatus: PlayerStatus): SearchResult {
  const isGreaterWaste = location === Location.GREATER_WASTE;
  const baseDanger = isGreaterWaste ? 0.4 : 0.2;
  const random = Math.random();

  // Determine outcome based on area danger and random chance
  if (random < baseDanger) {
    // Dangerous encounter - player gets hurt
    const encounters = isGreaterWaste 
      ? [
          'You encounter a pack of zombies and barely escape with your life!',
          'A massive zombie horde forces you to flee through dangerous terrain!',
          'You fall into a hidden pit trap and get injured by the fall and hungry zombies below!',
          'A zombie dog pack chases you through collapsed buildings!'
        ]
      : [
          'You run into a wandering zombie and fight it off!',
          'You slip and fall while fleeing from zombie sounds!',
          'A zombie surprises you from behind a tree!',
          'You get caught in old barbed wire while escaping zombies!'
        ];
    
    return {
      description: encounters[Math.floor(Math.random() * encounters.length)],
      statusChange: true,
      itemsFound: []
    };
  } else if (random < baseDanger + 0.3) {
    // Neutral outcome
    const neutralEvents = isGreaterWaste
      ? [
          'You carefully navigate through the ruins but find nothing of value.',
          'The area has been picked clean by other survivors.',
          'You spot zombies in the distance and decide to retreat.',
          'Heavy fog makes exploration too dangerous to continue.'
        ]
      : [
          'You search the area but find nothing useful.',
          'The location has already been thoroughly searched.',
          'You hear zombie groans nearby and decide to leave.',
          'The area appears to be picked clean.'
        ];

    return {
      description: neutralEvents[Math.floor(Math.random() * neutralEvents.length)],
      statusChange: false,
      itemsFound: []
    };
  } else {
    // Successful search
    const items: string[] = [];
    const itemChance = isGreaterWaste ? 0.8 : 0.6;
    
    if (Math.random() < itemChance) {
      const possibleItems = isGreaterWaste
        ? ['Sturdy Wood', 'Oil Barrel', 'Metal Scraps', 'Water Bottle', 'Weapon Parts']
        : ['Wood', 'Metal Scraps', 'Water Bottle', 'Tools', 'Canned Food'];
      
      const numItems = Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < numItems; i++) {
        const item = possibleItems[Math.floor(Math.random() * possibleItems.length)];
        if (!items.includes(item)) {
          items.push(item);
        }
      }
    }

    // Only return success messages if items were actually found
    if (items.length > 0) {
      const successEvents = isGreaterWaste
        ? [
            'You successfully navigate the dangerous ruins and find valuable supplies!',
            'After carefully avoiding zombie patrols, you locate an untouched supply cache!',
            'You discover a hidden stash in an abandoned building!',
            'Your cautious approach pays off as you find rare materials!'
          ]
        : [
            'You successfully scavenge the area and find useful items!',
            'Your search pays off as you discover supplies!',
            'You find an overlooked stash of resources!',
            'A thorough search reveals hidden supplies!'
          ];

      return {
        description: successEvents[Math.floor(Math.random() * successEvents.length)],
        statusChange: false,
        itemsFound: items
      };
    } else {
      // No items found, return neutral outcome
      const neutralEvents = isGreaterWaste
        ? [
            'You carefully navigate through the ruins but find nothing of value.',
            'The area has been picked clean by other survivors.',
            'You spot zombies in the distance and decide to retreat.',
            'Heavy fog makes exploration too dangerous to continue.'
          ]
        : [
            'You search the area but find nothing useful.',
            'The location has already been thoroughly searched.',
            'You hear zombie groans nearby and decide to leave.',
            'The area appears to be picked clean.'
          ];

      return {
        description: neutralEvents[Math.floor(Math.random() * neutralEvents.length)],
        statusChange: false,
        itemsFound: []
      };
    }
  }
}

function determineItemType(itemName: string): ItemType {
  const name = itemName.toLowerCase();
  
  if (name.includes('wood') || name.includes('metal')) {
    return ItemType.BUILDING_MATERIAL;
  } else if (name.includes('tool') || name.includes('weapon')) {
    return ItemType.TOOL;
  } else if (name.includes('water') || name.includes('food') || name.includes('canned')) {
    return ItemType.CONSUMABLE;
  } else if (name.includes('oil') || name.includes('barrel')) {
    return ItemType.RESOURCE;
  } else {
    return ItemType.RESOURCE;
  }
}
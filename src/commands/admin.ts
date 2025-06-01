import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { WorldMapService } from '../services/worldMap';
import { ItemService } from '../models/item';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { DatabaseService } from '../services/database';
import { Location, PlayerStatus, PlayerCondition } from '../types/game';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const worldMapService = WorldMapService.getInstance();
const itemService = new ItemService();
const inventoryService = new InventoryService();
const areaInventoryService = new AreaInventoryService();
const db = DatabaseService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands for testing purposes (requires password)')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Admin command to execute')
        .setRequired(true)
        .addChoices(
          { name: 'reset', value: 'reset' },
          { name: 'horde', value: 'horde' },
          { name: 'refresh', value: 'refresh' },
          { name: 'hordesize', value: 'hordesize' },
          { name: 'revive', value: 'revive' },
          { name: 'respawn', value: 'respawn' },
          { name: 'return', value: 'return' },
          { name: 'spawn', value: 'spawn' },
          { name: 'revealmap', value: 'revealmap' },
          { name: 'fillbank', value: 'fillbank' }
        )
    )
    .addStringOption(option =>
      option.setName('password')
        .setDescription('Admin password')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target user (required for refresh and revive commands)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('value')
        .setDescription('Value (required for hordesize command)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('itemname')
        .setDescription('Item name (required for spawn command)')
        .setRequired(false)
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const command = interaction.options.get('command')?.value as string;
      const password = interaction.options.get('password')?.value as string;
      const targetUser = interaction.options.get('user')?.user;
      const value = interaction.options.get('value')?.value as number;
      const itemName = interaction.options.get('itemname')?.value as string;

      // Validate admin password
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Admin Commands Disabled')
          .setDescription('Admin password is not configured in the environment.');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (password !== adminPassword) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('🔐 Access Denied')
          .setDescription('Invalid admin password.');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Execute admin command
      switch (command) {
        case 'reset':
          await handleResetCommand(interaction);
          break;
        case 'horde':
          await handleHordeCommand(interaction);
          break;
        case 'refresh':
          await handleRefreshCommand(interaction, targetUser);
          break;
        case 'hordesize':
          await handleHordeSizeCommand(interaction, value);
          break;
        case 'revive':
          await handleReviveCommand(interaction, targetUser);
          break;
        case 'respawn':
          await handleRespawnCommand(interaction, targetUser);
          break;
        case 'return':
          await handleReturnCommand(interaction, targetUser);
          break;
        case 'spawn':
          await handleSpawnCommand(interaction, targetUser, itemName);
          break;
        case 'revealmap':
          await handleRevealMapCommand(interaction);
          break;
        case 'fillbank':
          await handleFillBankCommand(interaction);
          break;
        default:
          const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Invalid Command')
            .setDescription('Unknown admin command.');
          
          await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      console.error('Error in admin command:', error);
      await interaction.reply({
        content: '❌ An error occurred while executing the admin command.',
        ephemeral: true
      });
    }
  }
};

async function handleResetCommand(interaction: CommandInteraction) {
  const success = await gameEngine.resetTown();
  
  // Also reset the map to initial state
  if (success) {
    await worldMapService.resetMap();
    
    // Clear bank contents
    try {
      await db.pool.query('DELETE FROM bank_inventories');
      console.log('✅ Bank contents cleared during world reset');
    } catch (error) {
      console.error('Error clearing bank contents:', error);
    }
  }
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '🔄 Complete World Reset' : '❌ Reset Failed')
    .setDescription(success 
      ? 'The entire world has been reset to its initial state. All players have been revived and restored to healthy status with full action points. The map has been reset and players will need to re-explore areas. All player inventories and bank contents have been cleared and coordinates reset. Zombies have been redistributed across the map.'
      : 'Failed to reset the world. Check the server logs for details.'
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleHordeCommand(interaction: CommandInteraction) {
  const success = await gameEngine.triggerHordeResults();
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#ff9f43' : '#ff6b6b')
    .setTitle(success ? '🧟‍♂️ Horde Attack Triggered' : '❌ Horde Attack Failed')
    .setDescription(success 
      ? 'A horde attack has been manually triggered. The results have been applied as if the horde phase just ended. The day has been advanced by 1.'
      : 'Failed to trigger horde attack. Check the server logs for details.'
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRefreshCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the refresh command.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const player = await playerService.getPlayer(targetUser.id);
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Not Found')
      .setDescription(`Player ${targetUser.username} is not registered in the game.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const success = await gameEngine.refreshPlayerActionPoints(targetUser.id);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '⚡ Action Points Refreshed' : '❌ Refresh Failed')
    .setDescription(success 
      ? `${targetUser.username}'s action points have been refreshed to maximum.`
      : `Failed to refresh action points for ${targetUser.username}. Check the server logs for details.`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleHordeSizeCommand(interaction: CommandInteraction, value: number | undefined) {
  if (value === undefined) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing Value')
      .setDescription('You must specify a value for the hordesize command.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (value < 1) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Invalid Value')
      .setDescription('Horde size must be at least 1.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const success = await gameEngine.setHordeSize(value);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '🧟‍♂️ Horde Size Updated' : '❌ Update Failed')
    .setDescription(success 
      ? `Horde size has been set to ${value}.`
      : 'Failed to update horde size. Check the server logs for details.'
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleReviveCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the revive command.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const player = await playerService.getPlayer(targetUser.id);
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Not Found')
      .setDescription(`Player ${targetUser.username} is not registered in the game.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (player.isAlive) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Already Alive')
      .setDescription(`${targetUser.username} is already alive.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const success = await gameEngine.revivePlayer(targetUser.id);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '⚕️ Player Revived' : '❌ Revival Failed')
    .setDescription(success 
      ? `${targetUser.username} has been revived and returned to the city with healthy status.`
      : `Failed to revive ${targetUser.username}. Check the server logs for details.`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRespawnCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the respawn command.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const player = await playerService.getPlayer(targetUser.id);
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Not Found')
      .setDescription(`Player ${targetUser.username} is not registered in the game.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Perform a full reset for the individual player
  try {
    // Reset player to alive state with healthy condition, full action points and return to city
    await playerService.updatePlayerHealth(targetUser.id, player.maxHealth);
    await playerService.updatePlayerStatus(targetUser.id, PlayerStatus.ALIVE);
    await playerService.updatePlayerLocation(targetUser.id, Location.CITY);
    await playerService.resetPlayerActionPoints(targetUser.id);
    
    // Clear all conditions and add healthy condition
    await playerService.removePlayerCondition(targetUser.id, PlayerCondition.WOUNDED);
    await playerService.addPlayerCondition(targetUser.id, PlayerCondition.HEALTHY);

    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle('🔄 Player Respawned')
      .setDescription(`${targetUser.username} has been fully reset - returned to city with healthy condition, full health, and maximum action points.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error respawning player:', error);
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Respawn Failed')
      .setDescription(`Failed to respawn ${targetUser.username}. Check the server logs for details.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleReturnCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the return command.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const player = await playerService.getPlayer(targetUser.id);
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Not Found')
      .setDescription(`Player ${targetUser.username} is not registered in the game.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Return player to town safely (without healing)
  const success = await playerService.updatePlayerLocation(targetUser.id, Location.CITY);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '🏠 Player Returned to Town' : '❌ Return Failed')
    .setDescription(success 
      ? `${targetUser.username} has been safely returned to the town. Status and health remain unchanged.`
      : `Failed to return ${targetUser.username} to town. Check the server logs for details.`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSpawnCommand(interaction: CommandInteraction, targetUser: any, itemName: string | undefined) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ User Required')
      .setDescription('Please specify a user to spawn the item for.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (!itemName) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Item Name Required')
      .setDescription('Please specify an item name to spawn.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Get the target player
  const player = await playerService.getPlayer(targetUser.id);
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Not Found')
      .setDescription(`${targetUser.username} is not registered. They need to use \`/join\` first.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Get the item
  const item = await itemService.getItemByName(itemName);
  if (!item) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Item Not Found')
      .setDescription(`Item "${itemName}" not found.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Check if player's inventory has space
  const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
  
  if (isEncumbered) {
    // Drop item on ground at player's location
    if (player.x !== null && player.x !== undefined && player.y !== null && player.y !== undefined) {
      await areaInventoryService.addItemToArea(player.location, item.id, 1, player.x, player.y);
      
      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle('📦 Item Spawned on Ground')
        .setDescription(`${item.name} spawned on the ground at ${targetUser.username}'s location because their inventory is full.`)
        .addFields([
          {
            name: '📍 Location',
            value: `${player.location} (${player.x}, ${player.y})`,
            inline: false
          }
        ])
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Cannot Spawn Item')
        .setDescription(`${targetUser.username}'s inventory is full and they are not in a valid location to drop items.`);
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } else {
    // Add item to player's inventory
    const success = await inventoryService.addItemToInventory(player.id, item.id, 1);
    
    const embed = new EmbedBuilder()
      .setColor(success ? '#4ecdc4' : '#ff6b6b')
      .setTitle(success ? '🎒 Item Spawned in Inventory' : '❌ Spawn Failed')
      .setDescription(success 
        ? `${item.name} has been added to ${targetUser.username}'s inventory.`
        : `Failed to spawn ${item.name}. Check the server logs for details.`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleRevealMapCommand(interaction: CommandInteraction) {

  try {
    // Reveal all tiles on the map for everyone (map revelation is global, not per-player)
    const mapSize = worldMapService.getMapSize();
    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        await worldMapService.markTileExplored(x, y);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle('🗺️ Map Revealed')
      .setDescription(`The entire ${mapSize}x${mapSize} map has been revealed for all players.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error revealing map:', error);
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Reveal Failed')
      .setDescription('Failed to reveal map for all players. Check the server logs for details.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleFillBankCommand(interaction: CommandInteraction) {
  try {
    // Get the default city
    const cityService = new (require('../models/city')).CityService();
    const city = await cityService.getDefaultCity();
    if (!city) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ City Not Found')
        .setDescription('Default city not found.');
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Get all items in the game
    const query = 'SELECT * FROM items';
    const result = await db.pool.query(query);
    const allItems = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      weight: row.weight
    }));
    
    // Get bank service
    const bankService = new (require('../models/bank')).BankService();
    
    let addedItems = 0;
    for (const item of allItems) {
      const success = await bankService.depositItem(city.id, item.id, 99);
      if (success) {
        addedItems++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle('🏦 Bank Filled')
      .setDescription(`Added 99 of ${addedItems} different items to the bank.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error filling bank:', error);
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Fill Failed')
      .setDescription('Failed to fill bank. Check the server logs for details.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
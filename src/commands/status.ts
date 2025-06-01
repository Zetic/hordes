import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { WorldMapService } from '../services/worldMap';
import { PlayerStatus, Location, isTemporaryCondition, isWoundType } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const worldMapService = WorldMapService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your current status and stats')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('Check another player\'s status')
        .setRequired(false)
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const targetUser = interaction.options.get('player')?.user || interaction.user;
      const discordId = targetUser.id;
      const isOwnStatus = discordId === interaction.user.id;

      // Get player data
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('👻 Player Not Found')
          .setDescription(isOwnStatus 
            ? 'You haven\'t joined the game yet! Use `/join` to start surviving.'
            : `${targetUser.displayName} hasn't joined the game yet.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      
      // Player status display
      const statusEmojis = {
        [PlayerStatus.ALIVE]: '💚',
        [PlayerStatus.WOUNDED_ARM]: '💪',
        [PlayerStatus.WOUNDED_EYE]: '👁️',
        [PlayerStatus.WOUNDED_FOOT]: '🦶',
        [PlayerStatus.WOUNDED_HAND]: '✋',
        [PlayerStatus.WOUNDED_HEAD]: '🧠',
        [PlayerStatus.WOUNDED_LEG]: '🦵',
        [PlayerStatus.DEAD]: '💀',
        [PlayerStatus.REFRESHED]: '💧',
        [PlayerStatus.FED]: '🍞',
        [PlayerStatus.THIRSTY]: '🫗',
        [PlayerStatus.DEHYDRATED]: '🏜️',
        [PlayerStatus.EXHAUSTED]: '😴',
        [PlayerStatus.HEALED]: '🩹',
        [PlayerStatus.INFECTED]: '🦠',
        [PlayerStatus.SCAVENGING]: '🔍'
      };
      const statusTexts = {
        [PlayerStatus.ALIVE]: 'Alive',
        [PlayerStatus.WOUNDED_ARM]: 'Wounded Arm',
        [PlayerStatus.WOUNDED_EYE]: 'Wounded Eye',
        [PlayerStatus.WOUNDED_FOOT]: 'Wounded Foot',
        [PlayerStatus.WOUNDED_HAND]: 'Wounded Hand',
        [PlayerStatus.WOUNDED_HEAD]: 'Wounded Head',
        [PlayerStatus.WOUNDED_LEG]: 'Wounded Leg',
        [PlayerStatus.DEAD]: 'Dead',
        [PlayerStatus.REFRESHED]: 'Refreshed',
        [PlayerStatus.FED]: 'Fed',
        [PlayerStatus.THIRSTY]: 'Thirsty',
        [PlayerStatus.DEHYDRATED]: 'Dehydrated',
        [PlayerStatus.EXHAUSTED]: 'Exhausted',
        [PlayerStatus.HEALED]: 'Healed',
        [PlayerStatus.INFECTED]: 'Infected',
        [PlayerStatus.SCAVENGING]: 'Scavenging'
      };
      
      // Location display
      const locationDisplay = worldMapService.getLocationDisplay(player.location);
      
      const locationNames = {
        [Location.CITY]: 'City (Safe Zone)',
        [Location.WASTE]: 'Waste (Dangerous)',
        [Location.GATE]: 'Gate',
        [Location.HOME]: 'Home',
        // New POI locations - all use same description for now
        [Location.ABANDONED_BUNKER]: 'Abandoned Bunker (Scavenging Available)',
        [Location.ABANDONED_CONSTRUCTION_SITE]: 'Abandoned Construction Site (Scavenging Available)',
        [Location.ABANDONED_HOSPITAL]: 'Abandoned Hospital (Scavenging Available)',
        [Location.ABANDONED_HOTEL]: 'Abandoned Hotel (Scavenging Available)',
        [Location.ABANDONED_PARK]: 'Abandoned Park (Scavenging Available)',
        [Location.ABANDONED_WELL]: 'Abandoned Well (Scavenging Available)',
        [Location.AMBULANCE]: 'Ambulance (Scavenging Available)',
        [Location.ARMY_OUTPOST]: 'Army Outpost (Scavenging Available)',
        [Location.BLOCKED_ROAD]: 'Blocked Road (Scavenging Available)',
        [Location.BROKEN_DOWN_TANK]: 'Broken-down Tank (Scavenging Available)',
        [Location.BURNT_SCHOOL]: 'Burnt School (Scavenging Available)',
        [Location.CAVE]: 'Cave (Scavenging Available)',
        [Location.CITIZENS_HOME]: "Citizen's Home (Scavenging Available)",
        [Location.CITIZENS_TENT]: "Citizen's Tent (Scavenging Available)",
        [Location.COLLAPSED_MINESHAFT]: 'Collapsed Mineshaft (Scavenging Available)',
        [Location.COLLAPSED_QUARRY]: 'Collapsed Quarry (Scavenging Available)',
        [Location.CONSTRUCTION_SITE_SHELTER]: 'Construction Site Shelter (Scavenging Available)',
        [Location.COSMETICS_LAB]: 'Cosmetics Lab (Scavenging Available)',
        [Location.CROWSFIT_GYM]: "Crows'fit Gym (Scavenging Available)",
        [Location.DARK_WOODS]: 'Dark Woods (Scavenging Available)',
        [Location.DERELICT_VILLA]: 'Derelict Villa (Scavenging Available)',
        [Location.DESERTED_FREIGHT_YARD]: 'Deserted Freight Yard (Scavenging Available)',
        [Location.DESTROYED_PHARMACY]: 'Destroyed Pharmacy (Scavenging Available)',
        [Location.DILAPIDATED_BUILDING]: 'Dilapidated Building (Scavenging Available)',
        [Location.DISUSED_CAR_PARK]: 'Disused Car Park (Scavenging Available)',
        [Location.DISUSED_SILOS]: 'Disused Silos (Scavenging Available)',
        [Location.DISUSED_WAREHOUSE]: 'Disused Warehouse (Scavenging Available)',
        [Location.DUKES_VILLA]: "Duke's Villa (Scavenging Available)",
        [Location.EQUIPPED_TRENCH]: 'Equipped Trench (Scavenging Available)',
        [Location.FAIRGROUND_STALL]: 'Fairground Stall (Scavenging Available)',
        [Location.FAMILY_TOMB]: 'Family Tomb (Scavenging Available)',
        [Location.FAST_FOOD_RESTAURANT]: 'Fast Food Restaurant (Scavenging Available)',
        [Location.FRASER_DS_KEBAB_ISH]: "Fraser D's Kebab-ish (Scavenging Available)",
        [Location.GARDEN_SHED]: 'Garden Shed (Scavenging Available)',
        [Location.GUNS_N_ZOMBIES_ARMOURY]: "Guns 'n' Zombies Armoury (Scavenging Available)",
        [Location.HOME_DEPOT]: 'Home Depot (Scavenging Available)',
        [Location.INDIAN_BURIAL_GROUND]: 'Indian Burial Ground (Scavenging Available)',
        [Location.LOOTED_SUPERMARKET]: 'Looted Supermarket (Scavenging Available)',
        [Location.MACS_ATOMIC_CAFE]: "Mac's Atomic Cafe (Scavenging Available)",
        [Location.MINI_MARKET]: 'Mini-Market (Scavenging Available)',
        [Location.MOTEL_666_DUSK]: 'Motel 666 Dusk (Scavenging Available)',
        [Location.MOTORWAY_SERVICES]: 'Motorway Services (Scavenging Available)',
        [Location.NUCLEAR_BUNKER]: 'Nuclear Bunker (Scavenging Available)',
        [Location.OLD_AERODROME]: 'Old Aerodrome (Scavenging Available)',
        [Location.OLD_BICYCLE_HIRE_SHOP]: 'Old Bicycle Hire Shop (Scavenging Available)',
        [Location.OLD_FIELD_HOSPITAL]: 'Old Field Hospital (Scavenging Available)',
        [Location.OLD_HYDRAULIC_PUMP]: 'Old Hydraulic Pump (Scavenging Available)',
        [Location.OLD_POLICE_STATION]: 'Old Police Station (Scavenging Available)',
        [Location.ONCE_INHABITED_CAVE]: 'Once-inhabited Cave (Scavenging Available)',
        [Location.PI_KEYA_FURNITURE]: 'PI-KEYA Furniture (Scavenging Available)',
        [Location.PLANE_CRASH_SITE]: 'Plane Crash Site (Scavenging Available)',
        [Location.POST_OFFICE]: 'Post Office (Scavenging Available)',
        [Location.SCOTTISH_SMITHS_SUPERSTORE]: "Scottish Smith's Superstore (Scavenging Available)",
        [Location.SHADY_BAR]: 'Shady Bar (Scavenging Available)',
        [Location.SMALL_HOUSE]: 'Small House (Scavenging Available)',
        [Location.SMUGGLERS_CACHE]: "Smugglers' Cache (Scavenging Available)",
        [Location.STRANGE_CIRCULAR_DEVICE]: 'Strange Circular Device (Scavenging Available)',
        [Location.THE_MAYOR_MOBILE]: "The 'Mayor-Mobile' (Scavenging Available)",
        [Location.THE_SHATTERED_ILLUSIONS_BAR]: "The 'Shattered Illusions' Bar (Scavenging Available)",
        [Location.TOWN_LIBRARY]: 'Town Library (Scavenging Available)',
        [Location.WAREHOUSE]: 'Warehouse (Scavenging Available)',
        [Location.WATER_PROCESSING_PLANT]: 'Water Processing Plant (Scavenging Available)',
        [Location.WRECKED_CARS]: 'Wrecked Cars (Scavenging Available)',
        [Location.WRECKED_TRANSPORTER]: 'Wrecked Transporter (Scavenging Available)'
      };

      const embed = new EmbedBuilder()
        .setColor(player.isAlive ? '#4ecdc4' : '#ff6b6b')
        .setTitle(`${player.name}'s Status`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields([
          { 
            name: '🧍 Status', 
            value: player.isAlive ? '🧍 Alive' : '💀 Dead', 
            inline: true 
          },
          ...(player.isAlive ? [{ 
            name: '🔄 Conditions', 
            value: player.conditions.length > 0 
              ? player.conditions.map(condition => `${statusEmojis[condition]} ${statusTexts[condition]}`).join('\n')
              : `${statusEmojis[player.status]} ${statusTexts[player.status]}`, 
            inline: true 
          }] : []),
          { 
            name: '⚡ Action Points', 
            value: `${player.actionPoints}/${player.maxActionPoints}`, 
            inline: true 
          },
          { 
            name: '📍 Location', 
            value: `${locationDisplay.emoji} ${locationNames[player.location] || locationDisplay.name}${player.x !== null && player.y !== null ? ` (${player.x}, ${player.y})` : ''}`, 
            inline: true 
          },
          { 
            name: '⏰ Last Action', 
            value: `<t:${Math.floor(player.lastActionTime.getTime() / 1000)}:R>`, 
            inline: true 
          }
        ]);

      // Add warnings for own status
      if (isOwnStatus) {
        const warnings = [];
        
        // Check if player has any wound type
        const hasWound = isWoundType(player.status) || player.conditions.some(condition => isWoundType(condition));
        if (hasWound) {
          warnings.push('🩸 You are wounded! Another injury could be fatal.');
        }
        
        if (player.water <= 1) warnings.push('🚨 Running out of water!');
        if (player.actionPoints <= 2) warnings.push('💤 Low action points');
        
        if (warnings.length > 0) {
          embed.addFields([
            { name: '⚠️ Warnings', value: warnings.join('\n') }
          ]);
        }
      }

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: isOwnStatus });

    } catch (error) {
      console.error('Error in status command:', error);
      await interaction.reply({
        content: '❌ An error occurred while checking status.',
        ephemeral: true
      });
    }
  }
};
import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { AreaInventoryService } from '../models/areaInventory';
import { Location, PlayerStatus, ItemType } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

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

      // Check if player is at the gate
      if (player.location === Location.GATE) {
        await interaction.reply({
          content: '❌ You cannot search at the gate. Use `/move` to explore other areas.',
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

      // Defer reply since we're about to do complex search processing
      await interaction.deferReply();

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

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in search command:', error);
      
      // Check if reply was already deferred
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while searching.'
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while searching.',
          ephemeral: true
        });
      }
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

  // Initialize location-specific values
  let locationDesc = '';
  let dangerEvents: string[] = [];
  let neutralEvents: string[] = [];
  let successEvents: string[] = [];
  let possibleItems: string[] = [];
  
  // Assign location-specific text and items
  switch (location) {
    case Location.FACTORY:
      locationDesc = 'factory';
      dangerEvents = [
        'The factory\'s heavy machinery crashes down nearly crushing you!',
        'Zombies in hard hats attack from the shadows!',
        'You slip on industrial fluids and badly hurt yourself!',
        'A section of rusted catwalk collapses under your weight!'
      ];
      neutralEvents = [
        'The factory floor has been completely stripped of useful components.',
        'Most tools have already been taken from this area.',
        'The machinery is too damaged to salvage any parts.',
        'The factory\'s storage areas have been completely emptied.'
      ];
      successEvents = [
        'You discover an untouched supply cabinet full of parts!',
        'Hidden behind some machinery, you find useful building materials!',
        'You manage to disassemble some factory equipment for parts!',
        'A maintenance closet yields some valuable tools!'
      ];
      possibleItems = ['Metal Sheets', 'Industrial Tools', 'Electrical Components', 'Steel Pipes', 'Industrial Adhesive'];
      break;
    
    case Location.ABANDONED_MANSION:
      locationDesc = 'abandoned mansion';
      dangerEvents = [
        'You fall through rotted floorboards into a basement full of zombies!',
        'A chandelier crashes down, nearly crushing you and drawing zombies!',
        'The mansion\'s previous owner, now zombified, lunges from behind a curtain!',
        'A hidden door opens, revealing a nest of the undead!'
      ];
      neutralEvents = [
        'The mansion has been thoroughly looted already.',
        'Most of the valuables appear to have been taken long ago.',
        'The mansion\'s rooms are empty save for broken furniture.',
        'Water damage has ruined anything that might have been useful.'
      ];
      successEvents = [
        'You find a hidden wall safe containing valuable items!',
        'A locked cabinet in the study yields some useful supplies!',
        'The mansion\'s kitchen still has some preserved food items!',
        'You discover a forgotten stash in the master bedroom!'
      ];
      possibleItems = ['Silverware', 'Antique Tools', 'Luxury Fabrics', 'Preserved Food', 'Old Medicine'];
      break;
    
    case Location.MODEST_NEIGHBORHOOD:
      locationDesc = 'modest neighborhood';
      dangerEvents = [
        'A family of zombies emerges from a house as you search!',
        'You trigger a makeshift alarm system, alerting nearby zombies!',
        'While searching a garage, you knock over a shelf that pins you down!',
        'A pet zombie dog attacks you from under a porch!'
      ];
      neutralEvents = [
        'The houses in this area have been thoroughly searched already.',
        'Most valuable items have been taken from these homes.',
        'The neighborhood has been picked clean by other survivors.',
        'You find nothing but broken furniture and personal effects.'
      ];
      successEvents = [
        'You find a well-stocked pantry that others overlooked!',
        'A tool shed behind one of the houses contains useful supplies!',
        'You discover a homeowner\'s emergency stash!',
        'One house has a basement with untouched supplies!'
      ];
      possibleItems = ['Canned Food', 'Household Tools', 'Batteries', 'Water Bottles', 'First Aid Supplies'];
      break;
      
    case Location.GATED_COMMUNITY:
      locationDesc = 'gated community';
      dangerEvents = [
        'Security zombies in uniform patrol the area and spot you!',
        'A house alarm triggers, drawing zombies from all directions!',
        'You stumble into a community pool filled with underwater zombies!',
        'A zombie neighborhood watch group surrounds you!'
      ];
      neutralEvents = [
        'The luxury homes have been stripped of valuables.',
        'Other survivors have already secured these houses thoroughly.',
        'The community seems to have been evacuated and cleaned out early in the outbreak.',
        'Most houses are sealed shut with no way to enter safely.'
      ];
      successEvents = [
        'You find a hidden panic room stocked with supplies!',
        'A wealthy homeowner\'s stash of emergency supplies remains untouched!',
        'You discover a well-stocked home gym with useful equipment!',
        'A home office yields some valuable and useful items!'
      ];
      possibleItems = ['Premium Tools', 'Expensive Electronics', 'Quality First Aid Kit', 'Gourmet Preserved Food', 'Fine Clothing'];
      break;
    
    case Location.CONVENIENCE_STORE:
      locationDesc = 'convenience store';
      dangerEvents = [
        'A group of zombies trapped in the walk-in cooler breaks free!',
        'The store\'s former clerk, now zombified, attacks from behind the counter!',
        'You slip on spilled fluids and crash into a display shelf!',
        'A zombified delivery person bursts through the loading dock doors!'
      ];
      neutralEvents = [
        'The convenience store shelves are completely empty.',
        'Looters have already taken everything of value.',
        'The store was cleaned out early in the outbreak.',
        'Nothing useful remains in the store or its storage area.'
      ];
      successEvents = [
        'You find an overlooked stock room with supplies!',
        'Behind the counter, you discover some valuable items!',
        'A locked cabinet in the office contains useful supplies!',
        'You discover a hidden safe with emergency supplies!'
      ];
      possibleItems = ['Energy Bars', 'Bottled Water', 'Over-the-Counter Medicine', 'Batteries', 'Lighters'];
      break;
    
    case Location.OFFICE_DISTRICT:
      locationDesc = 'office district';
      dangerEvents = [
        'Office worker zombies in suits swarm from a conference room!',
        'You get trapped in a malfunctioning elevator with zombies!',
        'While searching a server room, you electrocute yourself badly!',
        'Security system locks down, trapping you with several zombies!'
      ];
      neutralEvents = [
        'The offices have been completely ransacked already.',
        'Nothing of value remains in any of the cubicles or offices.',
        'The corporate supplies have all been looted.',
        'Office equipment is too damaged or heavy to be useful.'
      ];
      successEvents = [
        'You find a well-stocked breakroom with supplies!',
        'An executive office yields some valuable items!',
        'The office supply room still contains useful materials!',
        'You discover a technical workshop with specialized tools!'
      ];
      possibleItems = ['Office Tools', 'Electrical Components', 'Tech Gadgets', 'Coffee Supplies', 'Industrial Tape'];
      break;
    
    case Location.HOSPITAL:
      locationDesc = 'hospital';
      dangerEvents = [
        'Patient zombies in hospital gowns attack from the wards!',
        'A zombie surgeon still wielding a scalpel lunges at you!',
        'You get exposed to infectious materials while searching!',
        'The hospital\'s emergency generator shorts out, shocking you badly!'
      ];
      neutralEvents = [
        'The pharmacy and supply rooms have been completely stripped.',
        'Medical supplies have been thoroughly looted from this area.',
        'The hospital rooms contain nothing useful.',
        'Emergency supplies were evacuated during the outbreak.'
      ];
      successEvents = [
        'You discover an overlooked supply cabinet with medical items!',
        'A locked pharmaceutical cabinet yields valuable medicines!',
        'You find an untouched crash cart with medical supplies!',
        'A hidden emergency stash of supplies was left behind!'
      ];
      possibleItems = ['Antibiotics', 'Bandages', 'Surgical Tools', 'Pain Medication', 'IV Fluids'];
      break;
    
    case Location.SCHOOL_CAMPUS:
      locationDesc = 'school campus';
      dangerEvents = [
        'Zombified students emerge from classrooms as you search!',
        'A zombie teacher attacks you with surprising speed!',
        'You fall down a stairwell while fleeing from zombies!',
        'The school\'s mascot, now a zombie, charges at you from the gym!'
      ];
      neutralEvents = [
        'The school supplies have all been taken already.',
        'The cafeteria and vending machines are completely empty.',
        'Science labs have been stripped of useful equipment.',
        'Nothing of value remains in the classrooms or offices.'
      ];
      successEvents = [
        'You find an untouched supply closet with useful items!',
        'The nurse\'s office still has some medical supplies!',
        'A teacher\'s lounge yields some valuable items!',
        'You discover emergency supplies in the administration office!'
      ];
      possibleItems = ['Textbooks', 'Science Equipment', 'Art Supplies', 'Basic First Aid', 'Sports Equipment'];
      break;
    
    case Location.SHOPPING_MALL:
      locationDesc = 'shopping mall';
      dangerEvents = [
        'Mall zombies in various store uniforms corner you in a boutique!',
        'The mall\'s security system activates, trapping you with zombies!',
        'You crash through a glass display case, cutting yourself badly!',
        'Food court zombies swarm you while searching for supplies!'
      ];
      neutralEvents = [
        'The stores have all been thoroughly looted.',
        'Nothing of value remains in any of the shops.',
        'The mall has been picked clean by survivors.',
        'Even the storage areas behind stores are empty.'
      ];
      successEvents = [
        'You discover a stockroom that looters missed!',
        'A locked high-end store still has useful items!',
        'The mall\'s service corridors yield maintenance supplies!',
        'You find a survivalist store with overlooked gear!'
      ];
      possibleItems = ['Designer Clothes', 'Electronics', 'Camping Gear', 'Tools', 'Luxury Items'];
      break;
    
    case Location.HOTEL:
      locationDesc = 'hotel';
      dangerEvents = [
        'Hotel zombies in staff uniforms attack from service areas!',
        'A zombie maid bursts out of a housekeeping cart!',
        'You fall down a laundry chute into a basement full of zombies!',
        'The hotel\'s emergency doors lock, trapping you with zombies!'
      ];
      neutralEvents = [
        'The hotel rooms have all been searched thoroughly.',
        'Luggage and supplies have been looted already.',
        'The hotel restaurants and kitchens are completely empty.',
        'Nothing useful remains in the service areas or offices.'
      ];
      successEvents = [
        'You find an untouched hotel room with a guest\'s supplies!',
        'The hotel\'s maintenance area has useful tools!',
        'A storage room yields cleaning supplies and linens!',
        'You discover the hotel manager\'s emergency stash!'
      ];
      possibleItems = ['Toiletries', 'Towels', 'Small Electronics', 'Sewing Kit', 'Maintenance Tools'];
      break;
    
    case Location.CITY_PARK:
      locationDesc = 'city park';
      dangerEvents = [
        'Park zombies emerge from bushes and surround you!',
        'A zombified park maintenance worker attacks with gardening tools!',
        'You fall into a drainage ditch, injuring yourself badly!',
        'While searching a park building, zombies trap you inside!'
      ];
      neutralEvents = [
        'The park facilities have been stripped of useful items.',
        'The maintenance sheds are empty of tools.',
        'Nothing useful can be found in the park structures.',
        'Other survivors have already scavenged this area thoroughly.'
      ];
      successEvents = [
        'You find a groundskeeper\'s shed with useful tools!',
        'A park ranger\'s station has some emergency supplies!',
        'You discover survival gear in an overlooked storage area!',
        'A park vending machine still contains preserved snacks!'
      ];
      possibleItems = ['Garden Tools', 'Rope', 'Seeds', 'Water Purification Tablets', 'Outdoor Equipment'];
      break;
    
    case Location.AMUSEMENT_PARK:
      locationDesc = 'amusement park';
      dangerEvents = [
        'Zombies in mascot costumes surround you near a ride!',
        'A carnival game operator zombie traps you in a booth!',
        'You get injured by malfunctioning ride equipment!',
        'While searching a funhouse, the mirrors confuse you and zombies attack!'
      ];
      neutralEvents = [
        'The park concession stands have been completely looted.',
        'Ride control systems are too damaged to yield useful parts.',
        'Gift shops and game booths are empty of prizes or useful items.',
        'Maintenance areas have been stripped of tools and supplies.'
      ];
      successEvents = [
        'You find the control room with useful electronic components!',
        'A maintenance tunnel leads to a stash of tools!',
        'You discover a stockroom full of supplies!',
        'The park\'s first aid station still has medical supplies!'
      ];
      possibleItems = ['Electrical Parts', 'Mechanical Components', 'First Aid Supplies', 'Tools', 'Communication Equipment'];
      break;
    
    case Location.CONSTRUCTION_SITE:
      locationDesc = 'construction site';
      dangerEvents = [
        'Construction worker zombies wielding tools attack you!',
        'A partially constructed wall collapses on you!',
        'You fall into an open foundation, badly injuring yourself!',
        'While searching a trailer, zombies trap you inside!'
      ];
      neutralEvents = [
        'The construction site has been stripped of useful materials.',
        'Tools and equipment have already been looted.',
        'Building materials are too damaged or heavy to carry.',
        'The site offices have been thoroughly searched already.'
      ];
      successEvents = [
        'You discover an untouched supply of building materials!',
        'A locked tool container yields valuable equipment!',
        'You find useful items in the site manager\'s office!',
        'An overlooked storage area contains construction supplies!'
      ];
      possibleItems = ['Construction Tools', 'Building Materials', 'Industrial Supplies', 'Safety Equipment', 'Electrical Wiring'];
      break;
    
    case Location.RADIO_TOWER:
      locationDesc = 'radio tower';
      dangerEvents = [
        'Zombified technicians attack you in the control room!',
        'You suffer an electric shock from damaged equipment!',
        'A section of the tower structure breaks loose, nearly crushing you!',
        'While climbing the tower for supplies, you slip and fall!'
      ];
      neutralEvents = [
        'The radio equipment is too damaged to salvage parts.',
        'The control room has been stripped of useful components.',
        'Technical manuals and supplies have been taken already.',
        'Nothing useful remains in the facility buildings.'
      ];
      successEvents = [
        'You find valuable electronic components in the control room!',
        'A technician\'s toolkit with specialized instruments lies untouched!',
        'You discover emergency supplies in a locked cabinet!',
        'The facility\'s workshop contains useful technical parts!'
      ];
      possibleItems = ['Electronic Components', 'Communication Devices', 'Technical Manuals', 'Specialized Tools', 'Backup Batteries'];
      break;
    
    case Location.CAMP_GROUNDS:
      locationDesc = 'camp grounds';
      dangerEvents = [
        'Zombified campers emerge from tents as you search the area!',
        'A zombie park ranger attacks you with surprising agility!',
        'You disturb a bear while searching a cabin, and it charges!',
        'While exploring the woods, you fall into a hidden ravine!'
      ];
      neutralEvents = [
        'The camping cabins have been thoroughly searched.',
        'Camping supplies have all been taken by other survivors.',
        'The ranger station is empty of useful items.',
        'Abandoned tents contain nothing of value.'
      ];
      successEvents = [
        'You discover a camper\'s untouched survival gear!',
        'The camp store still has useful outdoor supplies!',
        'A ranger\'s vehicle contains emergency equipment!',
        'You find a hidden cache of camping supplies!'
      ];
      possibleItems = ['Camping Gear', 'Hiking Equipment', 'Water Filters', 'Preserved Food', 'Navigation Tools'];
      break;
    
    case Location.LAKE_SIDE:
      locationDesc = 'lake side';
      dangerEvents = [
        'Zombies emerge from the water as you search near the shore!',
        'You slip on wet rocks and injure yourself badly!',
        'A zombified fisherman attacks you with a gaff hook!',
        'While searching a boat, it starts to sink with you in it!'
      ];
      neutralEvents = [
        'The fishing supplies have all been taken already.',
        'Boats docked at the shore have been stripped of useful items.',
        'The lake houses have been thoroughly searched by survivors.',
        'Nothing useful remains in the lakeside facilities.'
      ];
      successEvents = [
        'You find useful fishing equipment in a lakeside cabin!',
        'A boat storage shed contains overlooked supplies!',
        'You discover survival gear in a park ranger\'s vessel!',
        'An untouched emergency kit lay hidden in a lake house!'
      ];
      possibleItems = ['Fishing Gear', 'Water Purifiers', 'Boat Parts', 'Life Jackets', 'Navigation Equipment'];
      break;
    
    case Location.WASTE:
      locationDesc = 'wasteland';
      dangerEvents = [
        'You run into a wandering zombie and fight it off!',
        'You slip and fall while fleeing from zombie sounds!',
        'A zombie surprises you from behind a tree!',
        'You get caught in old barbed wire while escaping zombies!'
      ];
      neutralEvents = [
        'You search the area but find nothing useful.',
        'The location has already been thoroughly searched.',
        'You hear zombie groans nearby and decide to leave.',
        'The area appears to be picked clean.'
      ];
      successEvents = [
        'You successfully scavenge the area and find useful items!',
        'Your search pays off as you discover supplies!',
        'You find an overlooked stash of resources!',
        'A thorough search reveals hidden supplies!'
      ];
      possibleItems = ['Wood', 'Metal Scraps', 'Water Bottle', 'Tools', 'Canned Food'];
      break;
    
    case Location.GREATER_WASTE:
      locationDesc = 'greater wasteland';
      dangerEvents = [
        'You encounter a pack of zombies and barely escape with your life!',
        'A massive zombie horde forces you to flee through dangerous terrain!',
        'You fall into a hidden pit trap and get injured by the fall and hungry zombies below!',
        'A zombie dog pack chases you through collapsed buildings!'
      ];
      neutralEvents = [
        'You carefully navigate through the ruins but find nothing of value.',
        'The area has been picked clean by other survivors.',
        'You spot zombies in the distance and decide to retreat.',
        'Heavy fog makes exploration too dangerous to continue.'
      ];
      successEvents = [
        'You successfully navigate the dangerous ruins and find valuable supplies!',
        'After carefully avoiding zombie patrols, you locate an untouched supply cache!',
        'You discover a hidden stash in an abandoned building!',
        'Your cautious approach pays off as you find rare materials!'
      ];
      possibleItems = ['Sturdy Wood', 'Oil Barrel', 'Metal Scraps', 'Water Bottle', 'Weapon Parts'];
      break;
    
    default:
      // Default to waste search texts and items if location doesn't match any case
      locationDesc = 'area';
      dangerEvents = [
        'You run into a wandering zombie and fight it off!',
        'You slip and fall while fleeing from zombie sounds!',
        'A zombie surprises you from behind cover!',
        'You get injured while escaping from zombies!'
      ];
      neutralEvents = [
        'You search the area but find nothing useful.',
        'The location has already been thoroughly searched.',
        'You hear zombie groans nearby and decide to leave.',
        'The area appears to be picked clean.'
      ];
      successEvents = [
        'You successfully scavenge the area and find useful items!',
        'Your search pays off as you discover supplies!',
        'You find an overlooked stash of resources!',
        'A thorough search reveals hidden supplies!'
      ];
      possibleItems = ['Wood', 'Metal Scraps', 'Water Bottle', 'Tools', 'Canned Food'];
  }
  
  // Determine outcome based on area danger and random chance
  if (random < baseDanger) {
    // Dangerous encounter - player gets hurt
    return {
      description: dangerEvents[Math.floor(Math.random() * dangerEvents.length)],
      statusChange: true,
      itemsFound: []
    };
  } else if (random < baseDanger + 0.3) {
    // Neutral outcome
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
      return {
        description: successEvents[Math.floor(Math.random() * successEvents.length)],
        statusChange: false,
        itemsFound: items
      };
    } else {
      // No items found, return neutral outcome
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
  
  // Building materials
  if (name.includes('wood') || name.includes('metal') || name.includes('pipe') || 
      name.includes('building') || name.includes('construction') ||
      name.includes('sheet') || name.includes('wiring')) {
    return ItemType.BUILDING_MATERIAL;
  } 
  // Tools
  else if (name.includes('tool') || name.includes('weapon') || name.includes('equipment') ||
           name.includes('gear') || name.includes('electronic') || name.includes('device') ||
           name.includes('component') || name.includes('tech') || name.includes('part') || 
           name.includes('instrument') || name.includes('manual')) {
    return ItemType.TOOL;
  } 
  // Consumables
  else if (name.includes('water') || name.includes('food') || name.includes('canned') ||
           name.includes('medicine') || name.includes('medical') || name.includes('antibiotics') ||
           name.includes('bandage') || name.includes('aid') || name.includes('toiletries') ||
           name.includes('coffee') || name.includes('supply') || name.includes('bar') || 
           name.includes('snack') || name.includes('fluid') || name.includes('tablet')) {
    return ItemType.CONSUMABLE;
  } 
  // Resources
  else if (name.includes('oil') || name.includes('barrel') || name.includes('fabric') ||
          name.includes('cloth') || name.includes('battery') || name.includes('seed') ||
          name.includes('rope') || name.includes('tape') || name.includes('jacket') ||
          name.includes('electrical') || name.includes('towel')) {
    return ItemType.RESOURCE;
  } 
  // Default to resource
  else {
    return ItemType.RESOURCE;
  }
}
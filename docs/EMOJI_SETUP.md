# Custom Emoji Configuration

This bot uses custom Discord emojis for map display. To set up custom emojis:

## Setting Up Custom Emojis

1. **Upload emojis to your Discord server**: Upload all the required emoji images to your Discord server with the correct names:
   - z_gate
   - z_evergreen_tree
   - z_factory
   - z_house
   - z_house_with_garden
   - z_house_abandoned
   - z_convience_store
   - z_office
   - z_hospital
   - z_school
   - z_department_store
   - z_hotel
   - z_fountain
   - z_ferris_wheel
   - z_construction_site
   - z_tokyo_tower
   - z_campsite
   - z_pond
   - z_player

2. **Get emoji IDs**: For each emoji, type `\:emoji_name:` in Discord and send the message. Discord will show the full emoji format like `<:z_gate:123456789012345678>`.

3. **Configure environment variables** (optional): Add the emoji IDs to your `.env` file:
   ```
   EMOJI_Z_GATE=<:z_gate:123456789012345678>
   EMOJI_Z_EVERGREEN_TREE=<:z_evergreen_tree:123456789012345678>
   # ... etc for all emojis
   ```

## Default Behavior

If no environment variables are set, the bot will use placeholder IDs (`000000000000000000`) which will display as the emoji name in Discord. The map will still function, but emojis won't display properly until real IDs are configured.

## Emoji Format

Discord custom emojis must use the format: `<:name:id>` where:
- `name` is the emoji name
- `id` is the 18-digit Discord emoji ID

The bot automatically handles this formatting when you provide the correct emoji IDs.
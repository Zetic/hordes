const { WorldMapService } = require('./dist/services/worldMap');

async function debugMap() {
  const service = WorldMapService.getInstance();
  const map = await service.generateMapView();
  console.log(map);
  
  const lines = map.split('\n');
  console.log('Number of lines:', lines.length);
  
  lines.forEach((line, i) => {
    console.log(`Line ${i + 1} length:`, line.length);
    console.log(`Line ${i + 1} emoji count:`, [...line].length);
    console.log(`Line ${i + 1}:`, [...line]);
  });
}

debugMap();
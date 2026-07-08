// ======================================================================
// Adaptive Heatmap Clustering
// ======================================================================

export function gridSizeForZoom(zoom) {

  if (zoom <= 2) return 8;
  if (zoom <= 3) return 4;
  if (zoom <= 4) return 2;
  if (zoom <= 5) return 1;
  if (zoom <= 6) return 0.5;
  if (zoom <= 7) return 0.25;
  if (zoom <= 9) return 0.10;

  return 0.05;

}

export function clusterSensors(
  sensors,
  {
    zoom = 2,
    maxExpectedCPM = 500,
    cpmWeight = 0.7,
    densityWeight = 0.3,
  } = {}
) {

  if (!sensors?.length)
    return [];

  const gridSize = gridSizeForZoom(zoom);

  const grid = new Map();

  //---------------------------------------------------
  // Build grid
  //---------------------------------------------------

  sensors.forEach(sensor => {

    const x = Math.floor(sensor.latitude / gridSize);
    const y = Math.floor(sensor.longitude / gridSize);

    const key = `${x}_${y}`;

    if (!grid.has(key)) {

      grid.set(key,{
        latSum:0,
        lonSum:0,
        cpmSum:0,
        count:0
      });

    }

    const cell = grid.get(key);

    cell.latSum += sensor.latitude;
    cell.lonSum += sensor.longitude;
    cell.cpmSum += sensor.cpm;
    cell.count++;

  });

  //---------------------------------------------------
  // Maximum density
  //---------------------------------------------------

  let maxDensity = 1;

  grid.forEach(cell=>{
    maxDensity =
      Math.max(maxDensity,cell.count);
  });

  //---------------------------------------------------
  // Build clusters
  //---------------------------------------------------

  const clusters=[];

  grid.forEach(cell=>{

    const avgCPM =
      cell.cpmSum / cell.count;

    const normalizedCPM =
      Math.min(
        avgCPM / maxExpectedCPM,
        1
      );

    const normalizedDensity =
      cell.count / maxDensity;

    const weight =
      normalizedCPM * cpmWeight +
      normalizedDensity * densityWeight;

    clusters.push({

      lat:
        cell.latSum / cell.count,

      lon:
        cell.lonSum / cell.count,

      averageCpm:avgCPM,

      sensorCount:cell.count,

      weight

    });

  });

  return clusters;

}
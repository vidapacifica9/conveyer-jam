import { generateLevel, isLevelSolvable } from '../src/game/levelGenerator';

let allPassed = true;

for (let lvl = 1; lvl <= 25; lvl++) {
  const config = generateLevel(lvl);
  const solvable = isLevelSolvable(config);

  const parcelTotal = config.parcels.length;
  const truckTotal = config.truckQueue.length;

  if (!solvable || parcelTotal !== truckTotal * 3) {
    console.error(`FAIL Level ${lvl}: solvable=${solvable}, parcels=${parcelTotal}, trucks=${truckTotal}`);
    allPassed = false;
  } else {
    const taped = config.parcels.filter((p) => p.kind === 'taped').length;
    const mystery = config.parcels.filter((p) => p.kind === 'mystery').length;
    const vip = config.parcels.filter((p) => p.kind === 'vip').length;
    console.log(
      `PASS Level ${lvl}: ${truckTotal} trucks, ${parcelTotal} parcels, active=${config.activeTruckCount}, colors=${config.colors.length}, taped=${taped}, mystery=${mystery}, vip=${vip}`
    );
  }
}

if (!allPassed) {
  process.exit(1);
}
console.log('\nAll 25 levels verified mathematically solvable!');

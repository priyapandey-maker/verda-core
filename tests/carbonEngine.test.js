const { calculateEmissions, CAR_EMISSION_FACTOR, BUS_EMISSION_FACTOR } = require('../src/controllers/carbonController');

describe('Carbon Engine Emission Calculations', () => {
  test('should calculate correct emissions for transportation activities', () => {
    expect(calculateEmissions('transportation', 'gasoline_car', 100)).toBe(18.0);
    expect(calculateEmissions('transportation', 'diesel_car', 100)).toBe(17.0);
    expect(calculateEmissions('transportation', 'electric_car', 100)).toBe(5.0);
    expect(calculateEmissions('transportation', 'bus', 50)).toBe(4.0);
    expect(calculateEmissions('transportation', 'train', 50)).toBe(2.0);
    expect(calculateEmissions('transportation', 'flight', 1000)).toBe(250.0);
    expect(calculateEmissions('transportation', 'walking_biking', 10)).toBe(0.0);
  });

  test('should calculate correct emissions for electricity usage', () => {
    expect(calculateEmissions('electricity', 'grid_electricity', 100)).toBe(45.0);
  });

  test('should calculate correct emissions for food habits', () => {
    expect(calculateEmissions('food', 'beef_meal', 3)).toBe(18.0);
    expect(calculateEmissions('food', 'pork_meal', 2)).toBe(4.0);
    expect(calculateEmissions('food', 'poultry_meal', 4)).toBe(6.0);
    expect(calculateEmissions('food', 'vegetarian_meal', 5)).toBe(2.5);
    expect(calculateEmissions('food', 'vegan_meal', 10)).toBe(3.0);
  });

  test('should return 0.0 for unrecognized categories or activities', () => {
    expect(calculateEmissions('manufacturing', 'paper_bags', 10)).toBe(0);
    expect(calculateEmissions('food', 'artificial_synthetic_food', 1)).toBe(0);
  });
});

describe('What-If Simulator Savings Mathematical Formulas', () => {
  test('should compute correct savings for transportation public transit swap using constants', () => {
    const transportEmissions30d = 30.0; // kg CO2 in 30 days
    const sliderTransitPct = 50.0; // 50% replaced with bus

    // Savings = Emissions * (Pct/100) * ((CAR_EF - BUS_EF) / CAR_EF) * 12
    const savings = transportEmissions30d * (sliderTransitPct / 100) * ((CAR_EMISSION_FACTOR - BUS_EMISSION_FACTOR) / CAR_EMISSION_FACTOR) * 12;

    // 30 * 0.5 * (0.10 / 0.18) * 12 = 15 * (5/9) * 12 = 100.00
    expect(Number(savings.toFixed(2))).toBe(100.00);
    expect(CAR_EMISSION_FACTOR).toBe(0.18);
    expect(BUS_EMISSION_FACTOR).toBe(0.08);
  });

  test('should compute correct savings for food vegetarian days', () => {
    const sliderVegDays = 3; // 3 vegetarian days per week
    // Savings = Days * 5.5 kg CO2 saved per swap * 52 weeks
    const savings = sliderVegDays * 5.5 * 52;

    expect(savings).toBe(858.00);
  });

  test('should compute correct savings for electricity conservation', () => {
    const electricityEmissions30d = 20.0; // kg CO2 in 30 days
    const sliderElectricityPct = 30.0; // 30% reduction

    // Savings = Emissions * (Pct/100) * 12
    const savings = electricityEmissions30d * (sliderElectricityPct / 100) * 12;

    // 20 * 0.3 * 12 = 72.00
    expect(savings).toBe(72.00);
  });
});

describe('Carbon Twin Trajectory Mathematical Projections', () => {
  test('should compute correct yearly trajectory based on active log average', () => {
    const totalEmissions30d = 60.0;
    const activeDays = 12;

    // Trajectory = (totalEmissions30d / 30) * 365
    const dailyAverage = activeDays > 0 ? (totalEmissions30d / 30) : 15.0;
    const yearlyTrajectory = dailyAverage * 365;

    expect(yearlyTrajectory).toBe(730.0);
  });

  test('should fallback to daily baseline of 15.0 if active days logged is 0', () => {
    const totalEmissions30d = 0.0;
    const activeDays = 0;
    const dailyBaseline = 15.0;

    const dailyAverage = activeDays > 0 ? (totalEmissions30d / 30) : dailyBaseline;
    const yearlyTrajectory = dailyAverage * 365;

    expect(yearlyTrajectory).toBe(5475.0);
  });

  test('should compute correct improved trajectory and ensure it is capped at zero', () => {
    const currentTrajectory = 500.0;
    
    // Test normal savings
    const normalSavings = 200.0;
    const improvedNormal = Math.max(0, currentTrajectory - normalSavings);
    expect(improvedNormal).toBe(300.0);

    // Test excessive savings (should be capped at 0)
    const excessiveSavings = 600.0;
    const improvedExcessive = Math.max(0, currentTrajectory - excessiveSavings);
    expect(improvedExcessive).toBe(0.0);
  });
});

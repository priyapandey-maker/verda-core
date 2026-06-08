const { calculateEmissions } = require('../src/controllers/carbonController');

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

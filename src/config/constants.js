/**
 * @file constants.js
 * @description Central repository for application constants, emission factors, and math coefficients to eliminate magic numbers.
 */

/** @constant {number} DAYS_IN_30D_WINDOW The tracking window duration in days for the dashboard, habits, and coach. */
const DAYS_IN_30D_WINDOW = 30;

/** @constant {number} DAYS_IN_YEAR Number of days in a year for projections. */
const DAYS_IN_YEAR = 365;

/** @constant {number} MAX_SCORE Maximum possible sustainability score. */
const MAX_SCORE = 100;

/** @constant {number} MAX_CONSISTENCY_BONUS Maximum consistency bonus points user can earn (1 point per logging day up to 10). */
const MAX_CONSISTENCY_BONUS = 10;

/** @constant {number} BEEF_VEG_EMISSION_DIFF Difference in emissions between beef and vegetarian meals (6.0 - 0.5). */
const BEEF_VEG_EMISSION_DIFF = 5.5;

/** @constant {number} DEFAULT_SAVINGS_MULTIPLIER Standard savings calculation multiplier (e.g. 0.55). */
const DEFAULT_SAVINGS_MULTIPLIER = 0.55;

/** @constant {number} DEFAULT_BASELINE_EMISSIONS Default daily baseline emissions in kg CO2. */
const DEFAULT_BASELINE_EMISSIONS = 15.0;

/** @constant {number} CAR_EMISSION_FACTOR Emission factor for gasoline car (kg CO2 per km). */
const CAR_EMISSION_FACTOR = 0.18;

/** @constant {number} BUS_EMISSION_FACTOR Emission factor for bus (kg CO2 per km). */
const BUS_EMISSION_FACTOR = 0.08;

/**
 * @constant {object} EMISSION_FACTORS Core emission factors (kg CO2 equivalent per unit) grouped by category.
 */
const EMISSION_FACTORS = {
  transportation: {
    gasoline_car: CAR_EMISSION_FACTOR, // per km
    diesel_car: 0.17,                  // per km
    electric_car: 0.05,                // per km
    bus: BUS_EMISSION_FACTOR,          // per km
    train: 0.04,                       // per km
    flight: 0.25,                      // per km
    walking_biking: 0.00               // per km
  },
  electricity: {
    grid_electricity: 0.45             // per kWh
  },
  food: {
    beef_meal: 6.0,                    // per meal
    pork_meal: 2.0,                    // per meal
    poultry_meal: 1.5,                 // per meal
    vegetarian_meal: 0.5,              // per meal
    vegan_meal: 0.3                    // per meal
  }
};

module.exports = {
  DAYS_IN_30D_WINDOW,
  DAYS_IN_YEAR,
  MAX_SCORE,
  MAX_CONSISTENCY_BONUS,
  BEEF_VEG_EMISSION_DIFF,
  DEFAULT_SAVINGS_MULTIPLIER,
  DEFAULT_BASELINE_EMISSIONS,
  CAR_EMISSION_FACTOR,
  BUS_EMISSION_FACTOR,
  EMISSION_FACTORS
};

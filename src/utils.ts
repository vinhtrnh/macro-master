import { Profile, Goal, ActivityLevel, FoodItem } from './types';

// BMR (Mifflin-St Jeor Equation)
export function calculateBMR(profile: Profile): number {
  const { weight, height, age, gender } = profile;
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

// TDEE Multipliers
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,          // Ít vận động
  lightly_active: 1.375,   // Vận động nhẹ (1-3 ngày/tuần)
  moderately_active: 1.55, // Vận động vừa (3-5 ngày/tuần)
  very_active: 1.725,      // Vận động nặng (6-7 ngày/tuần)
  extra_active: 1.9,       // Vận động rất nặng (VĐV, lao động nặng)
};

export function calculateStepsCalories(steps: number, weight: number): number {
  // 1 step is approx 0.04 calories for a 70kg person.
  // Formula adjusted for body weight: steps * 0.04 * (weight / 70)
  return Math.round(steps * 0.04 * (weight / 70));
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel, steps: number = 0, weight: number = 70): number {
  const baseTdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const stepsCalories = calculateStepsCalories(steps, weight);
  return Math.round(baseTdee + stepsCalories);
}

export interface MacroSplit {
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  isAdjustedForSafety: boolean;
}

export function calculateMacros(profile: Profile, tdee: number): MacroSplit {
  let calories = tdee;
  let proteinRatio = 2.0; // g/kg of body weight
  let fatPercentOfCal = 0.25; // 25% by default

  switch (profile.goal) {
    case 'cut_standard':
      calories = tdee - 500;
      proteinRatio = 2.2;
      fatPercentOfCal = 0.25;
      break;
    case 'cut_aggressive':
      calories = tdee - 800;
      proteinRatio = 2.5;
      fatPercentOfCal = 0.25;
      break;
    case 'maintenance':
      calories = tdee;
      proteinRatio = 2.0;
      fatPercentOfCal = 0.30;
      break;
    case 'bulk_standard':
      calories = tdee + 300;
      proteinRatio = 2.2;
      fatPercentOfCal = 0.25;
      break;
    case 'bulk_aggressive':
      calories = tdee + 500;
      proteinRatio = 2.2;
      fatPercentOfCal = 0.25;
      break;
  }

  // Ensure calories don't drop to absurdly low values (safety cap)
  const minSafeCalories = Math.max(1200, profile.gender === 'male' ? 1500 : 1200);
  if (calories < minSafeCalories) {
    calories = minSafeCalories;
  }

  // 1. Calculate Protein: 1g Protein = 4 kcal
  const protein = Math.round(proteinRatio * profile.weight);
  const proteinCal = protein * 4;

  // 2. Calculate Fat: 1g Fat = 9 kcal
  const fatCal = calories * fatPercentOfCal;
  const fat = Math.round(fatCal / 9);

  // 3. Calculate Carbs: Remaining calories. 1g Carb = 4 kcal
  let carbsCal = calories - proteinCal - fatCal;
  let carbs = Math.round(carbsCal / 4);
  let isAdjustedForSafety = false;

  // Sports Nutrition Safeguard: Carbs should be at least 1.0g per kg of body weight for energy and brain function
  const minCarbs = Math.round(1.0 * profile.weight);
  if (carbs < minCarbs) {
    carbs = minCarbs;
    carbsCal = carbs * 4;
    calories = Math.round(proteinCal + fatCal + carbsCal);
    isAdjustedForSafety = true;
  }

  // Re-calculate percentages
  const totalCal = (protein * 4) + (fat * 9) + (carbs * 4);
  const proteinPercent = Math.round(((protein * 4) / totalCal) * 100);
  const fatPercent = Math.round(((fat * 9) / totalCal) * 100);
  const carbsPercent = 100 - proteinPercent - fatPercent;

  return {
    calories: Math.round(totalCal),
    protein,
    carbs,
    fat,
    proteinPercent,
    carbsPercent,
    fatPercent,
    isAdjustedForSafety
  };
}

// Sports Nutritionist Assessment
export interface Assessment {
  rating: 'good' | 'warning_yellow' | 'warning_red';
  message: string;
  warnings: string[];
}

export function getAssessment(profile: Profile, targetCal: number, bmr: number, currentProtein: number): Assessment {
  const warnings: string[] = [];
  let rating: 'good' | 'warning_yellow' | 'warning_red' = 'good';

  // Warning 1: Target Calories < BMR
  if (targetCal < bmr) {
    rating = 'warning_red';
    warnings.push('Nguy hiểm: Lượng calo mục tiêu đang dưới mức BMR. Ăn dưới mức BMR kéo dài sẽ làm suy nhược cơ thể, mất cơ nghiêm trọng và giảm trao đổi chất.');
  }

  // Warning 2: Protein is too low for hypertrophy
  const proteinPerKg = currentProtein / profile.weight;
  if (proteinPerKg < 1.6) {
    if (rating !== 'warning_red') rating = 'warning_yellow';
    warnings.push(`Lượng protein hiện tại (${proteinPerKg.toFixed(1)}g/kg) hơi thấp để tối ưu hóa phì đại cơ bắp (Hypertrophy). Hãy cố gắng đạt tối thiểu 1.6g - 2.2g cho mỗi kg trọng lượng cơ thể.`);
  }

  let message = 'Tất cả các chỉ số đều nằm trong phạm vi lý tưởng cho mục tiêu của bạn!';
  if (rating === 'warning_red') {
    message = 'Cảnh báo sức khỏe nghiêm trọng! Cần điều chỉnh lại chế độ dinh dưỡng.';
  } else if (rating === 'warning_yellow') {
    message = 'Chế độ dinh dưỡng tạm ổn nhưng cần cải thiện lượng Protein để tối ưu cơ bắp.';
  }

  return { rating, message, warnings };
}

// Smart Suggestion Solver
export interface FoodSuggestion {
  foodItem: FoodItem;
  amountGrams: number;
  proteinAdded: number;
  carbsAdded: number;
  fatAdded: number;
  caloriesAdded: number;
}

export function generateSmartSuggestions(
  targetMacros: { protein: number; carbs: number; fat: number },
  consumedMacros: { protein: number; carbs: number; fat: number },
  foodDatabase: FoodItem[]
): FoodSuggestion[] {
  const proteinGap = Math.max(0, targetMacros.protein - consumedMacros.protein);
  const carbsGap = Math.max(0, targetMacros.carbs - consumedMacros.carbs);
  const fatGap = Math.max(0, targetMacros.fat - consumedMacros.fat);

  const suggestions: FoodSuggestion[] = [];

  // We find best clean matches for each gap:
  // 1. Protein Gap: Chicken breast ('f1' / Ức gà áp chảo) or any protein category
  const proteinFood = foodDatabase.find(f => f.category === 'protein') || foodDatabase[0];
  // 2. Carbs Gap: Sweet Potatoes ('f6' / Khoai lang luộc) or any carbs category
  const carbsFood = foodDatabase.find(f => f.category === 'carbs') || foodDatabase[5];
  // 3. Fats Gap: Avocado ('f10' / Quả bơ tươi) or any fats category
  const fatsFood = foodDatabase.find(f => f.category === 'fats') || foodDatabase[9];

  let remainingP = proteinGap;
  let remainingC = carbsGap;
  let remainingF = fatGap;

  // Resolve protein gap first (Chicken Breast adds protein and some fat, negligible carbs)
  if (remainingP > 2) {
    const pPer100 = proteinFood.protein;
    // Calculate how much food is needed (rounded to nearest 10g, min 30g)
    let amount = Math.ceil((remainingP / pPer100) * 100);
    amount = Math.max(30, Math.round(amount / 10) * 10);

    const proteinAdded = Math.round((amount * proteinFood.protein) / 100);
    const carbsAdded = Math.round((amount * proteinFood.carbs) / 100);
    const fatAdded = Math.round((amount * proteinFood.fat) / 100);
    const caloriesAdded = Math.round((amount * proteinFood.calories) / 100);

    suggestions.push({
      foodItem: proteinFood,
      amountGrams: amount,
      proteinAdded,
      carbsAdded,
      fatAdded,
      caloriesAdded
    });

    remainingP = Math.max(0, remainingP - proteinAdded);
    remainingC = Math.max(0, remainingC - carbsAdded);
    remainingF = Math.max(0, remainingF - fatAdded);
  }

  // Resolve carbs gap (Sweet Potatoes adds carbs, negligible protein/fat)
  if (remainingC > 5) {
    const cPer100 = carbsFood.carbs;
    let amount = Math.ceil((remainingC / cPer100) * 100);
    amount = Math.max(30, Math.round(amount / 10) * 10);

    const proteinAdded = Math.round((amount * carbsFood.protein) / 100);
    const carbsAdded = Math.round((amount * carbsFood.carbs) / 100);
    const fatAdded = Math.round((amount * carbsFood.fat) / 100);
    const caloriesAdded = Math.round((amount * carbsFood.calories) / 100);

    suggestions.push({
      foodItem: carbsFood,
      amountGrams: amount,
      proteinAdded,
      carbsAdded,
      fatAdded,
      caloriesAdded
    });

    remainingP = Math.max(0, remainingP - proteinAdded);
    remainingC = Math.max(0, remainingC - carbsAdded);
    remainingF = Math.max(0, remainingF - fatAdded);
  }

  // Resolve fat gap (Avocado adds healthy fats, low protein/carbs)
  if (remainingF > 1) {
    const fPer100 = fatsFood.fat;
    let amount = Math.ceil((remainingF / fPer100) * 100);
    amount = Math.max(20, Math.round(amount / 5) * 5);

    const proteinAdded = Math.round((amount * fatsFood.protein) / 100);
    const carbsAdded = Math.round((amount * fatsFood.carbs) / 100);
    const fatAdded = Math.round((amount * fatsFood.fat) / 100);
    const caloriesAdded = Math.round((amount * fatsFood.calories) / 100);

    suggestions.push({
      foodItem: fatsFood,
      amountGrams: amount,
      proteinAdded,
      carbsAdded,
      fatAdded,
      caloriesAdded
    });
  }

  return suggestions;
}

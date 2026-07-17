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

export function parseVoiceFoodInput(text: string): {
  name: string; amount: number; protein: number; carbs: number; fat: number;
} | null {
  // Chuẩn hóa chuỗi, bỏ phẩy, chấm, chuyển chữ thường
  const cleanText = text.replace(/[,.]/g, ' ').toLowerCase();

  // 1. Khối lượng: Đảo thứ tự (gram|gam|g) để nó ưu tiên bắt từ dài trước, hết bị lỗi "Am"
  const amountMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:gram|gam|g)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1]);

  // 2. Macro: Cho phép chèn thêm chữ "g", "gam" vào giữa số lượng và tên chất
  const proteinMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:gram|gam|g)?\s*(?:protein|đạm|pro)/i);
  const carbsMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:gram|gam|g)?\s*(?:carb|tinh bột)/i);
  const fatMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:gram|gam|g)?\s*(?:fat|béo|chất béo)/i);

  // 3. Cắt bỏ hết những thông số vừa tìm được ra khỏi câu gốc
  let name = cleanText
    .replace(amountMatch[0], '') 
    .replace(proteinMatch ? proteinMatch[0] : '', '') 
    .replace(carbsMatch ? carbsMatch[0] : '', '') 
    .replace(fatMatch ? fatMatch[0] : '', '');
    
  // 4. Dọn nốt các từ nối "và", "có", "chứa"... (nếu lúc đọc lỡ đệm vào)
  name = name.replace(/\b(có|chứa|khoảng|với|và)\b/gi, ' ');
  name = name.replace(/\s+/g, ' ').trim();

  // Viết hoa chữ cái đầu cho chuẩn form
  const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    amount,
    name: formattedName || "Món ăn",
    protein: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
    carbs: carbsMatch ? parseFloat(carbsMatch[1]) : 0,
    fat: fatMatch ? parseFloat(fatMatch[1]) : 0,
  };
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
  // 1. Chỉ lấy hệ số Sedentary (1.2) làm nền cho sinh hoạt nhẹ nhàng
  const sedentaryTdee = bmr * 1.2; 
  
  // 2. Cộng calo từ số bước chân (NEAT)
  const stepsCalories = calculateStepsCalories(steps, weight);
  
  // 3. Cộng calo từ buổi tập (Ước tính 350 kcal cho 1h15p tập tạ nặng)
  const trainingCalories = 350; 
  
  // 4. Nếu fen tập 5-6 buổi/tuần, hãy chia trung bình calo tập cho cả tuần
  const weeklyTrainingBurn = (trainingCalories * 6) / 7; 

  return Math.round(sedentaryTdee + stepsCalories + weeklyTrainingBurn);
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

  // ===== FEATURE 2: DIET TYPE OVERRIDE =====
  // Nếu user chọn chế độ ăn cụ thể (khác 'standard'), ghi đè 2 biến điều khiển
  // (proteinRatio, fatPercentOfCal) theo đúng tỷ lệ % đã chọn — thay vì dùng
  // công thức g/kg mặc định theo goal ở trên. Toàn bộ logic an toàn phía dưới
  // (min calories, min carbs) không đổi gì, vẫn áp dụng bình thường vì nó
  // chạy SAU đoạn này, dựa trên đúng 2 biến vừa được ghi đè.
  const DIET_TYPE_RATIOS: Partial<Record<NonNullable<Profile['dietType']>, { p: number; f: number }>> = {
    low_carb: { p: 0.30, f: 0.50 },   // 30% protein / 20% carb / 50% fat
    high_carb: { p: 0.20, f: 0.30 },  // 20% protein / 50% carb / 30% fat
  };
  const dietOverride = profile.dietType ? DIET_TYPE_RATIOS[profile.dietType] : undefined;
  if (dietOverride) {
    // Đổi từ "% protein trên tổng calo" sang "g/kg cân nặng" để tái dùng
    // đúng công thức protein = proteinRatio * weight ở bước 1 bên dưới,
    // không cần sửa gì thêm ở phần logic phía sau.
    const proteinGramsFromPercent = (calories * dietOverride.p) / 4;
    proteinRatio = proteinGramsFromPercent / profile.weight;
    fatPercentOfCal = dietOverride.f;
  }
  // ===== HẾT PHẦN FEATURE 2 =====

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

  // Sports Nutrition Safeguard: Carbs should be at least 1.0g per kg of body weight
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

// Thêm vào utils.ts
// Thêm vào utils.ts
// Thêm/Sửa vào utils.ts
// Sửa trong file utils.ts
export function calculateQuickMealPlan(
  calorieGap: number, // TRUYỀN THÊM CALO GAP VÀO ĐÂY LÀM MỎ NEO
  macroGaps: { protein: number; carbs: number; fat: number },
  proteinFood: FoodItem, carbFood: FoodItem, fatFood: FoodItem
) {
  if (calorieGap <= 0) return [];

  // Bước 1: Quy đổi Macro còn thiếu ra tỷ lệ Calo (P: 4, C: 4, F: 9)
  const pCal = Math.max(0, macroGaps.protein * 4);
  const cCal = Math.max(0, macroGaps.carbs * 4);
  const fCal = Math.max(0, macroGaps.fat * 9);
  const totalMacroCal = pCal + cCal + fCal || 1; // Tránh lỗi chia cho 0

  // Bước 2: Phân bổ Tỷ lệ % Calo cần nạp cho 3 món
  const pRatio = pCal / totalMacroCal;
  const cRatio = cCal / totalMacroCal;
  const fRatio = fCal / totalMacroCal;

  const plan = [];

  // Bước 3: Tính Gram thức ăn chốt cứng theo Calo phân bổ (KHÔNG THỂ VƯỢT CALO GAP)
  if (pRatio > 0 && proteinFood) {
    const assignedCal = calorieGap * pRatio;
    const grams = Math.max(0, Math.round((assignedCal / (proteinFood.calories || 1)) * 100));
    if (grams > 0) plan.push({ food: proteinFood, grams });
  }

  if (cRatio > 0 && carbFood) {
    const assignedCal = calorieGap * cRatio;
    const grams = Math.max(0, Math.round((assignedCal / (carbFood.calories || 1)) * 100));
    if (grams > 0) plan.push({ food: carbFood, grams });
  }

  if (fRatio > 0 && fatFood) {
    const assignedCal = calorieGap * fRatio;
    const grams = Math.max(0, Math.round((assignedCal / (fatFood.calories || 1)) * 100));
    if (grams > 0) plan.push({ food: fatFood, grams });
  }

  return plan;
}

// Hàm phụ: tìm món ăn theo tên (gần đúng) trong 1 category cụ thể
// Dùng cho cả UI picker lẫn agent voice (agent gửi tên dạng text tự do)
export function findFoodByNameInCategory(
  foodDatabase: FoodItem[], name: string, category: 'protein' | 'carbs' | 'fats'
): FoodItem | undefined {
  const normalized = name.toLowerCase().trim();
  return foodDatabase.find(
    f => f.category === category && f.name.toLowerCase().includes(normalized)
  ) || foodDatabase.find(f => f.category === category); // fallback: món đầu tiên trong category nếu không khớp tên
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

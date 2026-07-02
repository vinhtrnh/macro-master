export type Gender = 'male' | 'female';

export type ActivityLevel = 
  | 'sedentary' 
  | 'lightly_active' 
  | 'moderately_active' 
  | 'very_active' 
  | 'extra_active';

export type Goal = 
  | 'cut_standard' 
  | 'cut_aggressive' 
  | 'maintenance' 
  | 'bulk_standard' 
  | 'bulk_aggressive';

export interface Profile {
  id: number;
  name: string;
  age: number;
  gender: Gender;
  weight: number; // kg
  height: number; // cm
  activityLevel: ActivityLevel;
  goal: Goal;
  dailySteps?: number; // customizable daily step count
}

export type FoodCategory = 'protein' | 'carbs' | 'fats' | 'custom';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  protein: number; // per 100g or serving
  carbs: number;   // per 100g or serving
  fat: number;     // per 100g or serving
  calories: number; // per 100g or serving
  unit: string;     // "100g" or "phần" or "muỗng"
  isCustom?: boolean;
}

export interface LoggedMeal {
  id: string;
  foodId: string;
  name: string;
  amount: number; // grams or units
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}


export interface TravelExpenseInfo {
  over4hours: number;
  under4hours: number;
  note: string;
}

export interface OutsideWorkplaceExpenseInfo {
  dailyAllowance: number; // 일비
  mealAllowance: number; // 식비
  transportation: string; // 운임
  accommodation: string; // 숙박비
}

export interface EligibilityResult {
  isEligible: boolean;
  reason: string;
  applicableRule: string;
  travelExpense: TravelExpenseInfo;
  outsideWorkplaceExpense?: OutsideWorkplaceExpenseInfo;
}

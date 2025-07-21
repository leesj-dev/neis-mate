import type { Year } from "@/types";

/**
 * 현재 날짜를 기준으로 연도 배열과 기본값을 계산하는 함수
 * 1월-2월: 작년이 기본값, 현재+1년~현재-5년 범위
 * 3월-12월: 올해가 기본값, 현재+2년~현재-4년 범위
 */
export const getYearInfo = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 0-based이므로 +1
  
  // 1월-2월: 작년이 기본값, 3월-12월: 올해가 기본값
  const defaultYear = currentMonth <= 2 ? currentYear - 1 : currentYear;
  
  // 연도 배열 생성 - 월별로 다른 범위
  let years: number[];
  if (currentMonth <= 2) {
    // 1월-2월: 현재+1년~현재-5년 (총 7년)
    years = [
      currentYear + 1,
      currentYear,
      currentYear - 1,
      currentYear - 2,
      currentYear - 3,
      currentYear - 4,
      currentYear - 5
    ];
  } else {
    // 3월-12월: 현재+2년~현재-4년 (총 7년)
    years = [
      currentYear + 2,
      currentYear + 1,
      currentYear,
      currentYear - 1,
      currentYear - 2,
      currentYear - 3,
      currentYear - 4,
    ];
  }
  
  return { 
    years: years as Year[], 
    defaultYear: defaultYear as Year 
  };
};

/**
 * 연도 배열만 가져오는 함수
 */
export const getYears = (): Year[] => {
  return getYearInfo().years;
};

/**
 * 기본 연도만 가져오는 함수
 */
export const getDefaultYear = (): Year => {
  return getYearInfo().defaultYear;
};

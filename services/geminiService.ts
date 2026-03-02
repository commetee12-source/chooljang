import { GoogleGenAI, Type } from "@google/genai";
import { EligibilityResult } from '../types';

const checkTravelExpenseEligibility = async (workplace: string, destination: string, travelDays: number, expenseClass: string): Promise<EligibilityResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not configured. Please set the API_KEY environment variable.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema = {
    type: Type.OBJECT,
    properties: {
      isEligible: {
        type: Type.BOOLEAN,
        description: "근무지내 출장 여비 지급 대상 여부 (true/false)",
      },
      reason: {
        type: Type.STRING,
        description: "지급 대상 여부에 대한 상세하고 친절한 설명. '합니다체'로 작성.",
      },
      applicableRule: {
        type: Type.STRING,
        description: "판단에 적용된 주된 규정 (예: '행정구역 기준', '거리 기준', '복합 기준', '판단 불가')",
      },
      travelExpense: {
        type: Type.OBJECT,
        properties: {
          over4hours: {
            type: Type.NUMBER,
            description: "4시간 이상 출장 시 지급액 (원). 지급 대상이 아니면 0.",
          },
          under4hours: {
            type: Type.NUMBER,
            description: "4시간 미만 출장 시 지급액 (원). 지급 대상이 아니면 0.",
          },
          note: {
            type: Type.STRING,
            description: "공용차량 이용 시 감액 등 추가 정보. 지급 대상이 아니면 '해당 없음'.",
          },
        },
        required: ["over4hours", "under4hours", "note"],
      },
      outsideWorkplaceExpense: {
        type: Type.OBJECT,
        properties: {
            dailyAllowance: { type: Type.NUMBER, description: "일비 (원). 근무지외 출장일 경우 기재." },
            mealAllowance: { type: Type.NUMBER, description: "식비 (1일 기준 원). 근무지외 출장일 경우 기재." },
            transportation: { type: Type.STRING, description: "운임 (예: 실비 정산). 근무지외 출장일 경우 기재." },
            accommodation: { type: Type.STRING, description: "숙박비 (예: 실비 정산 (서울 상한 100,000원) 등 구체적 기재). 근무지외 출장일 경우 기재." }
        },
        description: "근무지내 출장이 아닐 경우(isEligible=false)에만 작성하는 근무지외 국내출장비 정보. 해당하지 않으면 null."
      }
    },
    required: ["isEligible", "reason", "applicableRule", "travelExpense"],
  };

  const prompt = `
    근무지: ${workplace}
    출장지: ${destination}
    출장 기간: ${travelDays}일
    여비 지급 구분: ${expenseClass}

    당신은 대한민국 공무원 여비 규정 전문가입니다.
    아래 [근무지내 국내출장 규정]과 [근무지외 국내출장 규정]을 참고하여 위 근무지에서 출장지까지의 이동에 대한 여비 지급 정보를 판단하고, 반드시 JSON 형식으로만 답변해주세요.

    [근무지내 국내출장 규정] (우선 판단 - 가장 중요함)
    1.  정의: '근무지내 국내출장'이란 같은 시(특별시, 광역시 및 특별자치시 포함)·군 및 섬(제주특별자치도 제외) 안에서의 출장이나 여행거리가 12km 미만인 출장을 말합니다.
    2.  ★핵심 기준★: 출장 시 그 거리가 12km를 넘더라도 동일한 시･군 및 섬(제주특별자치도 제외) 안에서의 출장인 경우 '근무지외 출장'이 아니고 무조건 '근무지내 국내출장'에 해당됩니다.
    3.  판단 순서:
        - 1순위: 근무지와 출장지가 동일한 시·군·섬(제주도 제외) 행정구역 내에 있는지 확인합니다. 동일하다면 거리가 12km 이상이어도 '근무지내 국내출장' (isEligible=true) 입니다.
        - 2순위: 행정구역이 다르다면, 거리가 12km 미만인지 확인합니다. 12km 미만이면 '근무지내 국내출장' (isEligible=true) 입니다.
        - 3순위: 위 두 가지에 해당하지 않으면 '근무지외 국내출장' (isEligible=false) 입니다.
    4.  여비 지급액:
        - 4시간 이상 출장: 20,000원
        - 4시간 미만 출장: 10,000원
    5.  감액: 공용차량을 이용하는 경우, 위 지급액에서 10,000원을 감액합니다. (2만원은 1만원으로, 1만원은 0원으로)

    [근무지외 국내출장 규정] (근무지내 출장에 해당하지 않을 경우 적용)
    1.  적용 대상: 위 [근무지내 국내출장 규정]에 해당하지 않는 모든 국내 출장.
    2.  여비 지급 기준 (여비지급등급표 적용):
        - 선택된 여비 지급 구분(${expenseClass})에 맞춰 일비, 식비, 숙박비를 산정하세요.
        - 제1호: 국무위원 등 고위공직자, 시도교육청 국장(장학관), 교육지원청 교육장, 3급이상(국장) 및 교장 해당. 숙박비는 실비(상한액이 높거나 없음).
        - 제2호: 그 외 공무원. 숙박비는 지역별 상한액 적용 (서울: 100,000원, 광역시/세종: 80,000원, 그 외: 70,000원 등 최신 규정 반영).
        - 식비: 제1호 25,000원, 제2호 25,000원 (최신 규정상 동일할 수 있음, 확인 후 적용).
        - 일비: 25,000원 (정액).
    3.  운임: 실비 지급.

    [작성 지침]
    1. 먼저 '근무지내 국내출장' 여부를 판단하여 isEligible에 true/false를 설정하세요. 핵심 기준(동일 시/군 내 12km 초과 시에도 근무지내)을 엄격히 적용하세요.
    2. isEligible이 true이면, travelExpense 필드를 채우고 outsideWorkplaceExpense는 null로 두세요.
    3. isEligible이 false이면, travelExpense의 금액은 0으로 하고, outsideWorkplaceExpense 필드에 '근무지외 국내출장' 기준을 채우세요.
       - outsideWorkplaceExpense의 금액은 1일 기준 단가로 작성하세요.
       - 숙박비의 경우, 출장지(${destination})의 지역(서울/광역시/기타)과 선택된 등급(${expenseClass})에 맞는 정확한 상한액 정보를 포함하여 문자열로 작성하세요. (예: "실비 (상한액 70,000원)")
    4. reason에는 판단 근거(행정구역 동일 여부, 거리 등)를 상세히 설명하세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
      },
    });

    const jsonText = response.text.trim();
    const cleanedJsonText = jsonText.replace(/^```json\s*|```\s*$/g, '');
    const result = JSON.parse(cleanedJsonText);
    return result as EligibilityResult;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`AI 모델 호출에 실패했습니다: ${error.message}`);
    }
    throw new Error("AI 모델 호출 중 알 수 없는 오류가 발생했습니다.");
  }
};

export default checkTravelExpenseEligibility;
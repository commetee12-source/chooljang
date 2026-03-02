import React, { useState, useCallback, FC } from 'react';
import checkTravelExpenseEligibility from './services/geminiService';
import { EligibilityResult } from './types';

const Spinner: FC = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const CheckCircleIcon: FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon: FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoCard: FC<{ title: string; value: string; note?: string; colorClass: string; }> = ({ title, value, note, colorClass }) => (
  <div className={`p-4 rounded-lg ${colorClass}`}>
    <p className="text-base text-gray-700 font-medium">{title}</p>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
    {note && <p className="text-sm text-gray-600 mt-1">{note}</p>}
  </div>
);

const ResultCard: FC<{ result: EligibilityResult; travelDays: number; expenseClass: string }> = ({ result, travelDays, expenseClass }) => {
  const { isEligible, reason, applicableRule, travelExpense, outsideWorkplaceExpense } = result;
  const statusColor = isEligible ? 'green' : 'blue';

  return (
    <div className="mt-8 w-full animate-fade-in">
      <div className={`p-6 rounded-lg shadow-md border-l-4 border-${statusColor}-500 bg-white`}>
        <div className="flex items-center mb-4">
          <CheckCircleIcon className={`h-8 w-8 text-${statusColor}-500 mr-3`} />
          <h2 className="text-3xl font-bold text-gray-800">
            {isEligible ? '근무지내 국내출장입니다.' : '관외출장입니다.'}
          </h2>
        </div>
        <p className="text-lg text-gray-700 mb-6 leading-relaxed">{reason}</p>

        {isEligible ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoCard title="4시간 이상 출장" value={`${travelExpense.over4hours.toLocaleString()}원`} colorClass="bg-blue-100" />
              <InfoCard title="4시간 미만 출장" value={`${travelExpense.under4hours.toLocaleString()}원`} colorClass="bg-indigo-100" />
              <InfoCard title="적용 규정" value={applicableRule} colorClass="bg-gray-200" />
            </div>
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md text-base text-yellow-800">
                <p><strong>참고:</strong> {travelExpense.note}</p>
            </div>
          </>
        ) : (
            <div className="mt-6">
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">💡 근무지외 국내출장 (관외출장) 여비 기준</h3>
                    <p className="text-base text-gray-600 mb-4">
                        근무지내 출장에 해당하지 않으므로, 일반적인 국내출장(관외) 기준이 적용됩니다. <br/>
                        <span className="font-semibold text-blue-600">출장 기간 {travelDays}일, {expenseClass}</span> 기준으로 계산된 예상 금액입니다.
                    </p>
                    {outsideWorkplaceExpense ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InfoCard 
                                title="일비 (합계)" 
                                value={`${(outsideWorkplaceExpense.dailyAllowance * travelDays).toLocaleString()}원`} 
                                note={`1일 ${outsideWorkplaceExpense.dailyAllowance.toLocaleString()}원 × ${travelDays}일`}
                                colorClass="bg-emerald-100" 
                            />
                            <InfoCard 
                                title="식비 (합계)" 
                                value={`${(outsideWorkplaceExpense.mealAllowance * travelDays).toLocaleString()}원`} 
                                note={`1일 ${outsideWorkplaceExpense.mealAllowance.toLocaleString()}원 × ${travelDays}일`}
                                colorClass="bg-emerald-100" 
                            />
                            <InfoCard 
                                title="운임" 
                                value={outsideWorkplaceExpense.transportation} 
                                colorClass="bg-gray-100" 
                            />
                            <InfoCard 
                                title="숙박비" 
                                value={outsideWorkplaceExpense.accommodation} 
                                colorClass="bg-gray-100" 
                            />
                        </div>
                    ) : (
                        <p className="text-base text-gray-500">관외 출장 정보를 불러올 수 없습니다.</p>
                    )}
                     <p className="text-sm text-gray-500 mt-4">
                        * 위 금액은 일반적인 기준이며, 공용차량 이용, 식사 제공 여부 등에 따라 감액될 수 있습니다.
                    </p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const App: FC = () => {
  const [workplace, setWorkplace] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [travelDays, setTravelDays] = useState<number>(1);
  const [expenseClass, setExpenseClass] = useState<string>('제2호');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workplace.trim() || !destination.trim()) {
      setError('근무지와 출장지를 모두 입력해주세요.');
      return;
    }
    if (travelDays < 1) {
      setError('출장 일수는 1일 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const apiResult = await checkTravelExpenseEligibility(workplace, destination, travelDays, expenseClass);
      setResult(apiResult);
    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('알 수 없는 오류가 발생했습니다.');
        }
    } finally {
      setIsLoading(false);
    }
  }, [workplace, destination, travelDays, expenseClass]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <main className="w-full max-w-3xl mx-auto">
        <header className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-blue-400 tracking-tight">공무원 출장비</h1>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">지급 계산기</h2>
            <p className="mt-4 text-slate-300 text-lg max-w-xl mx-auto">
                근무지와 출장지를 입력하면 공무원 여비 규정에 근거하여 '근무지내 국내출장' 해당 여부를 알려드립니다.
            </p>
        </header>

        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="workplace-input" className="block text-lg font-medium text-gray-700 mb-2">
                            나의 근무지 (예: 서울시교육청, 관악고등학교)
                        </label>
                        <input
                            id="workplace-input"
                            type="text"
                            value={workplace}
                            onChange={(e) => setWorkplace(e.target.value)}
                            placeholder="근무지를 상세하게 입력하세요"
                            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                        <label htmlFor="destination-input" className="block text-lg font-medium text-gray-700 mb-2">
                            출장지 (예: 서울시 강남구, 경기도 과천시청)
                        </label>
                        <input
                            id="destination-input"
                            type="text"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="출장지를 상세하게 입력하세요"
                            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="days-input" className="block text-lg font-medium text-gray-700 mb-2">
                                출장 일수 (일)
                            </label>
                            <input
                                id="days-input"
                                type="number"
                                min="1"
                                value={travelDays}
                                onChange={(e) => setTravelDays(parseInt(e.target.value) || 1)}
                                placeholder="예: 1"
                                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <label htmlFor="class-select" className="block text-lg font-medium text-gray-700 mb-2">
                                여비 지급 구분 (호수)
                            </label>
                            <select
                                id="class-select"
                                value={expenseClass}
                                onChange={(e) => setExpenseClass(e.target.value)}
                                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
                                disabled={isLoading}
                            >
                                <option value="제1호">제1호 (고위공무원 등)</option>
                                <option value="제2호">제2호 (그 외 공무원)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-6 w-full px-6 py-3 bg-blue-600 text-white text-xl font-bold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    {isLoading ? '확인 중...' : '확인하기'}
                </button>
            </form>
        </div>

        {isLoading && <Spinner />}

        {error && (
            <div className="mt-8 p-4 bg-red-100 border border-red-300 text-red-800 rounded-md text-center">
                <strong>오류:</strong> {error}
            </div>
        )}

        {result && <ResultCard result={result} travelDays={travelDays} expenseClass={expenseClass} />}
      </main>
      <footer className="w-full max-w-3xl mx-auto text-center text-sm text-slate-400 mt-12">
        <p>&copy; {new Date().getFullYear()} AI Travel Expense Checker. 이 결과는 AI 모델에 의해 생성되었으며, 참고용으로만 사용해주시기 바랍니다.</p>
      </footer>
    </div>
  );
};

export default App;
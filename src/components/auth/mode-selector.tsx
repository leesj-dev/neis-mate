import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import type { UserMode } from '@/types';

export function ModeSelector() {
  const [selectedMode, setSelectedMode] = useState<UserMode | null>(null);
  const { user, setUser } = useAppStore();

  const handleModeSelect = (mode: UserMode) => {
    setSelectedMode(mode);
  };

  const handleConfirm = () => {
    if (selectedMode && user) {
      setUser({ ...user, mode: selectedMode });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">사용 모드를 선택해주세요</h1>
          <p className="text-muted-foreground">
            사용 목적에 맞는 모드를 선택하면 더 편리하게 메모를 관리할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ModeCard
            mode="일반"
            title="일반"
            description="자유롭게 폴더를 만들고 메모를 관리하고 싶은 분들"
            features={[
              "폴더 생성 및 관리",
              "자유로운 제목 설정",
              "중첩 폴더 지원",
              "파일 버전 관리"
            ]}
            selected={selectedMode === '일반'}
            onSelect={() => handleModeSelect('일반')}
          />

          <ModeCard
            mode="학생"
            title="학생"
            description="학년별, 과목별로 체계적으로 메모를 관리하고 싶은 학생분들"
            features={[
              "학년별 자동 분류",
              "과목별 정리",
              "자동 폴더 구조",
              "버전 관리"
            ]}
            selected={selectedMode === '학생'}
            onSelect={() => handleModeSelect('학생')}
          />

          <ModeCard
            mode="교사"
            title="교사"
            description="연도, 학년, 과목, 학생별로 세밀하게 관리하고 싶은 교사분들"
            features={[
              "연도별 분류",
              "학년/과목별 정리",
              "학생별 개별 관리",
              "상세 분류 체계"
            ]}
            selected={selectedMode === '교사'}
            onSelect={() => handleModeSelect('교사')}
          />
        </div>

        <div className="text-center">
          <Button
            onClick={handleConfirm}
            disabled={!selectedMode}
            className="px-8 py-3"
          >
            선택 완료
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ModeCardProps {
  mode: UserMode;
  title: string;
  description: string;
  features: string[];
  selected: boolean;
  onSelect: () => void;
}

function ModeCard({ title, description, features, selected, onSelect }: ModeCardProps) {
  return (
    <div
      className={`border rounded-lg p-6 cursor-pointer transition-all ${
        selected 
          ? 'border-primary bg-primary/5 shadow-md' 
          : 'border-border hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{description}</p>
      
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="text-sm flex items-center">
            <span className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"></span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

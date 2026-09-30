# 픽셀 선거

후보 2~10명 중 한 명을 동일 확률로 뽑고, 약 30초의 픽셀 선거 쇼로 발표하는 정적 웹 앱입니다. 신문 호외, 시민들의 투표, 세 투표함의 단계별 집계, 봉인된 마지막 함과 봉투 공개, 당선 세리머니가 이어집니다. 집계가 끝날 때마다 순위가 한 번씩 정리되며, 중간에는 결과와 캐릭터 반응을 읽을 시간을 줍니다. 응원 후보를 선택할 수 있고, 이 선택은 당선 확률에 영향을 주지 않습니다. 이름과 주제는 같은 브라우저 탭의 세션에 저장됩니다. 표시되는 투표수와 득표율은 게임 연출 데이터입니다.

## 로컬 실행

```bash
npm ci
npm run dev
```

## 검증 및 배포 준비

```bash
npm test
npm run build
npm run preview
```

Vercel에서는 이 저장소를 연결하고 Framework Preset을 **Vite**, Build Command를 `npm run build`, Output Directory를 `dist`로 설정하면 됩니다. 서버, 환경 변수, 데이터베이스는 필요하지 않습니다. 배포는 아직 실행하지 않았습니다.

## 구조

- `src/election.ts`: Web Crypto 기반 균등 추첨, 투표수 및 개표 연출 데이터
- `src/GameStage.tsx`: Phaser 픽셀 무대와 장면
- `src/game/`: 연속 장면 전환, 팔·다리 관절 캐릭터, 투표와 개표 무대
- `src/show.ts`: 28초 진행 시간과 속보 문구
- `src/BroadcastShow.tsx`: 방송 자막과 움직이는 순위표
- `src/App.tsx`: 입력, 진행, 개표 및 결과 UI

사운드, 로그인, 기록 저장, 실제 투표 및 공유 기능은 MVP 범위 밖입니다.

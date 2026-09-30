export type StoryKind = 'brawl' | 'scandal' | 'comeback' | 'mishap' | 'alliance' | 'blackout';

export type StoryTemplate = {
  id: string;
  kind: StoryKind;
  title: string;
  detail: string;
  prop: string;
};

/** Cartoon incidents: each draw samples a small cast of stories from this catalogue. */
export const STORY_CATALOG: StoryTemplate[] = [
  { id: 'brawl-01', kind: 'brawl', title: '대기실 방석 쟁탈전', detail: '하나뿐인 푹신한 방석을 두고 후보들이 한 치도 물러서지 않습니다.', prop: '방석' },
  { id: 'brawl-02', kind: 'brawl', title: '마지막 쿠키 충돌', detail: '마지막 쿠키에 동시에 손이 닿자 긴급 팔꿈치 협상이 시작됩니다.', prop: '쿠키 접시' },
  { id: 'brawl-03', kind: 'brawl', title: '악수가 너무 강합니다', detail: '인사로 시작한 악수가 자존심을 건 손힘 대결로 번집니다.', prop: '악수 장갑' },
  { id: 'brawl-04', kind: 'brawl', title: '응원봉을 돌려주세요', detail: '가장 반짝이는 응원봉을 잡은 두 후보가 조용히 줄다리기를 합니다.', prop: '응원봉' },
  { id: 'brawl-05', kind: 'brawl', title: '어깨 너비 기싸움', detail: '후보들이 점점 넓게 서자 좁은 출입문이 먼저 양보합니다.', prop: '좁은 문' },
  { id: 'brawl-06', kind: 'brawl', title: '커피 줄 새치기 소동', detail: '커피 줄의 순서를 두고 후보들이 발끝으로 치열한 위치 싸움을 합니다.', prop: '커피 번호표' },
  { id: 'brawl-07', kind: 'brawl', title: '포토존 중앙 쟁탈', detail: '기념사진의 정중앙을 차지하려는 어깨 밀기가 길어지고 있습니다.', prop: '사진 프레임' },
  { id: 'brawl-08', kind: 'brawl', title: '깃발은 놓지 않겠습니다', detail: '같은 깃발을 든 후보들이 서로의 공약 방향으로 끌어당깁니다.', prop: '긴 깃발' },
  { id: 'brawl-09', kind: 'brawl', title: '마이크 공동 점유 사태', detail: '한 마이크에 두 후보가 동시에 말해 모든 공약이 웅얼거림이 됩니다.', prop: '마이크' },
  { id: 'brawl-10', kind: 'brawl', title: '슬리퍼 발등 대치', detail: '대기실 슬리퍼의 주인을 가리려고 후보들이 발등으로 밀어붙입니다.', prop: '슬리퍼' },

  { id: 'scandal-01', kind: 'scandal', title: '간식 예산 감사 착수', detail: '공용 젤리가 개인 주머니에서 발견돼 긴급 조달 감사가 열립니다.', prop: '젤리 봉지' },
  { id: 'scandal-02', kind: 'scandal', title: '쿠폰 장부 이중 기록', detail: '같은 커피 쿠폰이 두 장부에 등장해 간식 회계팀이 출동합니다.', prop: '커피 쿠폰' },
  { id: 'scandal-03', kind: 'scandal', title: '비밀 과자 창고 적발', detail: '공용 과자 재고가 후보의 비밀 서랍에서 산처럼 쏟아집니다.', prop: '과자 서랍' },
  { id: 'scandal-04', kind: 'scandal', title: '무료 공약의 작은 글씨', detail: '무료 간식 공약 아래에 본인 제외라는 깨알 문구가 발견됩니다.', prop: '공약 확대경' },
  { id: 'scandal-05', kind: 'scandal', title: '커피 크기 축소 논란', detail: '큰 잔을 약속한 후보가 몰래 에스프레소 잔을 주문했습니다.', prop: '작은 커피잔' },
  { id: 'scandal-06', kind: 'scandal', title: '위원장 몫 선지급 의혹', detail: '중립 간식 심판의 책상에 당선 축하용 케이크가 먼저 도착합니다.', prop: '예약 케이크' },
  { id: 'scandal-07', kind: 'scandal', title: '도넛 증빙이 사라졌다', detail: '영수증에는 도넛 열 개지만 상자에는 가루만 남아 있습니다.', prop: '빈 도넛 상자' },
  { id: 'scandal-08', kind: 'scandal', title: '응원단의 대가성 지급', detail: '응원단 계약서에 박수 한 번당 사탕 한 개라는 조항이 드러납니다.', prop: '사탕 계약서' },
  { id: 'scandal-09', kind: 'scandal', title: '젤리 담보 공약 조사', detail: '아직 사지도 않은 젤리를 담보로 세 번 약속한 사실이 확인됩니다.', prop: '젤리 차용증' },
  { id: 'scandal-10', kind: 'scandal', title: '샌드위치 재고 실종', detail: '모두의 샌드위치가 후보 전용 도시락에 포개져 있었습니다.', prop: '두꺼운 도시락' },

  { id: 'comeback-01', kind: 'comeback', title: '야간조의 깜짝 지지', detail: '늦게 퇴근한 응원단이 한꺼번에 도착해 조용했던 이름을 외칩니다.', prop: '야간 응원 팻말' },
  { id: 'comeback-02', kind: 'comeback', title: '잃어버린 봉투 발견', detail: '책상 아래에 숨어 있던 응원 봉투가 마지막 순간 빛을 봅니다.', prop: '먼지 묻은 봉투' },
  { id: 'comeback-03', kind: 'comeback', title: '우산 공약이 적중했다', detail: '갑자기 내린 비에 우산을 챙겨온 후보만 당당하게 웃습니다.', prop: '큰 우산' },
  { id: 'comeback-04', kind: 'comeback', title: '낮잠단이 깨어났다', detail: '개표 소리에 깨어난 낮잠 동호회가 뒤늦게 열렬한 응원을 보냅니다.', prop: '수면 안대' },
  { id: 'comeback-05', kind: 'comeback', title: '동창회 단체 입장', detail: '후보의 옛 동창들이 이름을 알아보고 즉석 응원단을 꾸립니다.', prop: '동창회 현수막' },
  { id: 'comeback-06', kind: 'comeback', title: '스티커 한 장의 추격', detail: '마지막 응원 스티커 한 장이 붙으며 게시판의 판세가 달라집니다.', prop: '별 스티커' },
  { id: 'comeback-07', kind: 'comeback', title: '공약 시연 대성공', detail: '단 한 번에 종이비행기를 날린 후보에게 뜻밖의 박수가 쏟아집니다.', prop: '종이비행기' },
  { id: 'comeback-08', kind: 'comeback', title: '고양이의 깜짝 선택', detail: '방송국 고양이가 후보 무릎에 앉자 구경꾼들이 환호하기 시작합니다.', prop: '고양이 방석' },
  { id: 'comeback-09', kind: 'comeback', title: '도시락 뚜껑을 열다', detail: '후보의 캐릭터 도시락이 공개되자 대기실의 시선이 한곳에 모입니다.', prop: '캐릭터 도시락' },
  { id: 'comeback-10', kind: 'comeback', title: '퇴근 버스 응원 도착', detail: '버스 창문마다 붙은 응원 팻말이 잠잠했던 개표장을 뒤집습니다.', prop: '버스 응원판' },

  { id: 'mishap-01', kind: 'mishap', title: '바나나 껍질 비상', detail: '멋지게 등장하던 후보가 바나나 껍질 위에서 갑자기 춤을 춥니다.', prop: '바나나 껍질' },
  { id: 'mishap-02', kind: 'mishap', title: '악수 손이 엇갈렸다', detail: '왼손과 오른손을 바꾸다 후보 두 명이 어색한 손가락 매듭이 됩니다.', prop: '꼬인 악수' },
  { id: 'mishap-03', kind: 'mishap', title: '접이식 의자의 결단', detail: '후보가 앉기도 전에 의자가 먼저 접혀 예의를 갖춥니다.', prop: '접이식 의자' },
  { id: 'mishap-04', kind: 'mishap', title: '현수막이 거꾸로였다', detail: '야심 찬 공약 현수막이 거꾸로 걸려 응원단까지 고개를 기울입니다.', prop: '뒤집힌 현수막' },
  { id: 'mishap-05', kind: 'mishap', title: '축하 풍선 조기 출발', detail: '손을 놓친 축하 풍선이 아직 당선되지 않은 후보를 끌고 갑니다.', prop: '축하 풍선' },
  { id: 'mishap-06', kind: 'mishap', title: '명찰이 바뀌었습니다', detail: '서로 바뀐 명찰을 뒤늦게 발견한 후보들이 이름부터 다시 소개합니다.', prop: '바뀐 명찰' },
  { id: 'mishap-07', kind: 'mishap', title: '공약집이 날아갔다', detail: '의기양양하게 펼친 공약집이 선풍기 앞에서 종이 눈보라가 됩니다.', prop: '흩어진 공약집' },
  { id: 'mishap-08', kind: 'mishap', title: '커피를 위한 묵념', detail: '후보가 소매를 걷다가 커피를 쏟자 대기실이 잠시 조용해집니다.', prop: '넘어진 커피잔' },
  { id: 'mishap-09', kind: 'mishap', title: '양말이 길을 찾았다', detail: '급하게 인사하던 후보의 양말 한 짝이 신발보다 먼저 등장합니다.', prop: '줄무늬 양말' },
  { id: 'mishap-10', kind: 'mishap', title: '기념사진 눈감기 참사', detail: '가장 진지한 표정으로 찍은 사진에서 후보만 정확히 눈을 감습니다.', prop: '기념사진' },

  { id: 'alliance-01', kind: 'alliance', title: '커피와 빵의 연합', detail: '커피 담당과 빵 담당 후보가 완벽한 간식 조합을 선언합니다.', prop: '커피와 빵' },
  { id: 'alliance-02', kind: 'alliance', title: '청소 구역 교환 협정', detail: '책상과 바닥을 나누기로 한 후보들이 빗자루를 교차해 약속합니다.', prop: '청소 구역표' },
  { id: 'alliance-03', kind: 'alliance', title: '마지막 의자 양보', detail: '의자를 양보받은 후보가 상대의 응원 팻말도 함께 들어 줍니다.', prop: '양보한 의자' },
  { id: 'alliance-04', kind: 'alliance', title: '민트초코 휴전 선언', detail: '민트초코 논쟁을 멈춘 후보들이 일단 바닐라를 나눠 먹습니다.', prop: '바닐라 아이스크림' },
  { id: 'alliance-05', kind: 'alliance', title: '우산 공동 사용 조약', detail: '한 우산을 나눠 쓴 두 후보가 비 오는 날의 공동 공약을 발표합니다.', prop: '공동 우산' },
  { id: 'alliance-06', kind: 'alliance', title: '응원봉 색상 합의', detail: '색이 다른 응원단이 응원봉을 섞어 새로운 물결을 만듭니다.', prop: '두 색 응원봉' },
  { id: 'alliance-07', kind: 'alliance', title: '낮잠 시간 보장 협약', detail: '후보들이 서로의 낮잠 시간을 지켜 주는 매우 조용한 동맹을 맺습니다.', prop: '낮잠 협약서' },
  { id: 'alliance-08', kind: 'alliance', title: '쿠키 반쪽 연대', detail: '하나뿐인 쿠키를 반으로 나눈 후보들이 부스러기까지 공평하게 셉니다.', prop: '반쪽 쿠키' },
  { id: 'alliance-09', kind: 'alliance', title: '발표 순서 상호 양보', detail: '먼저 발표하라는 두 후보의 양보가 이어지며 응원단이 한편이 됩니다.', prop: '발표 순서표' },
  { id: 'alliance-10', kind: 'alliance', title: '충전기 공유 협정', detail: '배터리 위기를 넘긴 후보들이 충전 케이블을 나눠 쓰기로 약속합니다.', prop: '긴 충전 케이블' },

  { id: 'blackout-01', kind: 'blackout', title: '개표장 조명이 잠들다', detail: '조명이 꺼지자 후보들이 휴대용 비상등 아래에서 눈치를 봅니다.', prop: '비상등' },
  { id: 'blackout-02', kind: 'blackout', title: '자막이 옆으로 누웠다', detail: '방송 자막이 세로로 돌아가 모두가 고개를 기울여 읽습니다.', prop: '돌아간 자막판' },
  { id: 'blackout-03', kind: 'blackout', title: '확성기 혼자 음소거', detail: '확성기가 멈추자 진행자가 입 모양만으로 비장한 소식을 전합니다.', prop: '음소거 확성기' },
  { id: 'blackout-04', kind: 'blackout', title: '전광판 숫자 숨바꼭질', detail: '전광판의 한 칸이 꺼지며 후보들이 사라진 숫자를 찾아 웅성거립니다.', prop: '꺼진 전광판' },
  { id: 'blackout-05', kind: 'blackout', title: '응원봉 배터리 이 퍼센트', detail: '응원봉이 한꺼번에 흐려지자 응원단이 더 열심히 손으로 반짝입니다.', prop: '방전 응원봉' },
  { id: 'blackout-06', kind: 'blackout', title: '무전기에 점심 주문', detail: '개표 보고 대신 점심 메뉴가 들려와 후보들이 뜻밖의 진지한 표정입니다.', prop: '혼선 무전기' },
  { id: 'blackout-07', kind: 'blackout', title: '프린터가 멈추지 않는다', detail: '결과 용지 대신 공약 복사본이 끝없이 나와 책상 위에 산을 쌓습니다.', prop: '종이 프린터' },
  { id: 'blackout-08', kind: 'blackout', title: '자동문이 춤을 춘다', detail: '자동문이 계속 열렸다 닫히자 입장하던 후보도 박자에 맞춰 멈춥니다.', prop: '자동문 센서' },
  { id: 'blackout-09', kind: 'blackout', title: '카메라에 과자 얼룩', detail: '렌즈에 묻은 과자 가루 때문에 모든 후보가 뜻밖의 후광을 얻습니다.', prop: '과자 묻은 카메라' },
  { id: 'blackout-10', kind: 'blackout', title: '타이머가 숨을 참는다', detail: '카운트다운 한 칸이 멈춰 진행자가 손가락으로 남은 시간을 셉니다.', prop: '멈춘 타이머' },
];

# 임시 웹사이트 배포

Firebase Hosting으로 싱글 플레이 게임을 배포한다.

- 게임 주소: https://voxel-fishing-choi.web.app/
- 대체 주소: https://voxel-fishing-choi.firebaseapp.com/
- Firebase / Google Cloud 프로젝트 ID: `voxel-fishing-choi`
- 프로젝트 표시 이름: `Voxel Fishing`
- Firebase 관리: https://console.firebase.google.com/project/voxel-fishing-choi/hosting
- Google Cloud 관리: https://console.cloud.google.com/home/dashboard?project=voxel-fishing-choi

## 다시 배포

프로젝트 폴더에서 `npm run deploy`를 실행한다. 타입 검사와 프로덕션 빌드가 성공하면 `dist`를 Firebase Hosting에 업로드하고 Firestore 규칙을 배포한다. Firebase CLI가 해당 프로젝트에 접근할 수 있는 계정으로 로그인되어 있어야 한다. 새 PC에서는 Firebase CLI 설치와 `firebase login`이 필요하다.

배포 대상은 `firebase.json`의 명시적 Hosting 사이트와 `.firebaserc`의 전용 프로젝트로 고정했다. HTML은 재확인하도록 하고, 해시가 붙은 자바스크립트·CSS 파일은 장기 캐시한다. 클라이언트 지도 선택 URL은 `/`의 쿼리 문자열을 사용한다.

## 현재 저장 방식

지금 배포는 싱글 게임을 웹주소에서 제공하는 구성이다. 게임 데이터는 접속한 브라우저의 로컬 저장소를 사용한다. 다른 기기나 다른 도메인의 저장 데이터와 자동으로 동기화되지 않는다. 개발 서버에서 만들었던 기록도 배포 주소에서는 별도로 시작한다. 기본 접속 주소는 `web.app`을 사용한다.

Google 로그인, 중복 없는 닉네임, 낚시터별 실시간 채팅, 어종별 온라인 최대어 랭킹은 Firebase Authentication과 서울 리전 Firestore에 연결했다. Google 로그인과 닉네임 설정 뒤 입장 자리를 확보하면 버들못에 자동 입장한다. 기존 로그인 상태와 닉네임도 접속 시 복원하며, 로그아웃하면 시작 화면으로 돌아간다. 계정, 낚시터 채팅, 온라인 랭킹은 메뉴에서 각각 분리했다. L은 온라인 랭킹을 연다.

로그인 후 닉네임을 저장해야 채팅과 조과 등록에 참여할 수 있다. 채팅은 현재 낚시터의 최근 50개 메시지, 랭킹은 어종별 전체/현재 낚시터 상위 20명을 표시한다. 플레이어 자신의 최고 길이만 갱신하며, 닉네임을 변경하면 기존 랭킹의 표시 이름도 갱신한다. 메시지는 200자, 전송 간격은 서버 규칙 기준 3초다.

채팅은 낚시 화면 왼쪽 아래의 반투명 창에서 계속 수신한다. Enter 또는 채팅 제목을 눌러 입력하고 Enter로 전송, Esc 또는 빈 입력의 Enter로 낚시에 돌아간다. 한글 조합 중 Enter는 전송하지 않는다. 입력 중에는 걷기·챔질 입력을 해제하고 마우스 잠금을 풀며, 채팅 접기와 이전 메시지 스크롤을 제공한다.

낚시터별 정원은 24명이다. 시작 화면과 낚시터 선택 카드, 채팅 제목에 현재 인원 / 정원을 표시한다. `presence/{map}/slots/0~23`을 트랜잭션으로 확보한 뒤 게임에 입장하며, 서버 규칙도 이 범위 밖의 자리를 거부한다. 정원이 차면 시작 화면에 안내하고 다시 입장을 시도할 수 있다. 닫힌 낚시터는 서버에서도 입장 자리를 만들지 못한다. 동시 입장은 [Firestore 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions)으로 충돌을 처리한다.

접속 자리는 서버 시각으로 40초마다 갱신하며, 150초 동안 갱신이 없으면 인원에서 제외하고 재사용한다. 로그아웃과 페이지 종료 때 자리를 해제하되 비정상 종료는 임대 만료로 정리한다. 같은 계정은 한 명으로 집계하고, 다른 창에서 같은 자리를 사용하면 이전 창의 플레이를 멈춘다. 접속을 확인하지 못한 창도 입장 화면으로 돌아간다. 채팅 전송은 서버에서 유효한 입장 자리와 세션을 확인한다. 정원 변경 시 `FISHERY_CAPACITY`와 Firestore 규칙의 슬롯 범위·쿼리 제한을 함께 변경한다.

게임 진행 전체의 클라우드 저장과 다른 플레이어의 3D 캐릭터가 보이는 멀티플레이는 아직 연결하지 않았다. 임시 랭킹은 클라이언트의 싱글 조과를 받는다. 서버 규칙은 계정 소유권·닉네임·수치 범위·최대어의 증가만 검사하며, 조과 시뮬레이션의 진위 판정은 향후 서버 시뮬레이션 단계에서 추가해야 한다.

Firestore는 `asia-northeast3`(서울)의 기본 데이터베이스를 사용한다. Firebase Console에서 Google 제공업체를 실제 활성화했고, 허용 도메인에 두 Hosting 기본 주소와 localhost가 등록되어 있다.

## 낚시터 바로가기

- 버들못: https://voxel-fishing-choi.web.app/?map=willow

현재 버들못만 개방한다. 연화 수초늪·달빛 산정호·금빛 양어장의 카드와 구현은 유지하고 입장은 막았다. 잠긴 맵의 직접 URL과 기존 지도 선택 기록도 버들못으로 대체한다. 재개방은 `src/game/fisheries.ts`의 `OPEN_FISHERIES` 목록으로 관리한다.

현재는 빠른 입질 확인 모드가 기본이다. 일반 속도는 `?fast=0` 또는 지도 주소 뒤에 `&fast=0`을 추가한다.

예: https://voxel-fishing-choi.web.app/?map=willow&fast=0

실제 구매 도메인은 필요하지 않다. 현재 Firebase 기본 주소를 사용한다. 추후 보유 도메인을 연결하려면 Firebase Console의 Hosting → 커스텀 도메인 추가에서 DNS 연결을 진행한다.

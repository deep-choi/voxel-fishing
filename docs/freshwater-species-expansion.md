# 민물 어종·품종 확장

기존 9개에 떡붕어·누치·비단잉어·가죽잉어·육종향어·초어를 추가해 도감 15개 항목으로 구성한다. 비단잉어·가죽잉어·향어·육종향어는 모두 별개의 생물학적 종이라는 뜻이 아니다. 관상용·양식용 개량 품종과 비늘 형태를 게임 도감에서 구분하며 `classificationText`로 이를 표시한다. 이름과 분류가 불명확한 ‘긴붕어’는 추가하지 않았다.

## 확인한 공공 자료

- [국립수산과학원: 붕어 종류에 대한 답변](https://www.nifs.go.kr/board/actionBoard0008View.do?BBS_CL_CD=C&BBS_ID=20201228031218150AOS&MENU_ID=M0000054): 붕어와 떡붕어를 다른 종으로 설명한다.
- [경상북도 민물고기연구센터: 떡붕어](https://www.gb.go.kr/Main/finace/page.do?BD_CODE=fish_exotics&B_NUM=35786800&cmd=2&mnu_uid=15847): 밝은 몸색, 머리 뒤의 높은 체고와 좁아지는 꼬리 부분을 모델에 반영했다.
- [국립수산과학원: 누치](https://www.nifs.go.kr/portal/bt/frctA/actionSpeciesSearchView.do?taxonId=10510): `Hemibarbus labeo` 국명 확인.
- [국립수산과학원: 비단잉어 양식](https://www.nifs.go.kr/board/actionBoard0018PopupPrevew.do?BBS_ID=20211228033704563OZF): 관상용 개량 품종과 색 무늬를 참고했다. 게임 모델은 직접 만든 흰색·붉은색 복셀 무늬다.
- [경상북도 민물고기연구센터: 향어](https://www.gb.go.kr/Main/finace/page.do?BD_CODE=fish_exotics&B_NUM=35785300&cmd=2&mnu_uid=15847): 잉어의 개량 품종이며 가죽잉어와 거울잉어의 비늘 형태를 구분한다. 게임의 기존 향어는 거울비늘형으로 표시하고, 가죽잉어는 비늘이 매우 적은 형태로 구분한다.
- [국립수산과학원: 육종향어 개발](https://www.nifs.go.kr/news/actionNewsView.do?MENU_ID=M0000307&NEWS_SEQ=2522): 향어의 선발 육종과 높은 체고·적은 비늘을 참고했다. [2018년 보급 자료](https://nifs.go.kr/news/actionNewsView.do?MENU_ID=M0000307&NEWS_D_DATE_BEGIN=2010-01-01&NEWS_D_DATE_END=2023-09-27&NEWS_D_SUBJECT=&NEWS_SEQ=3063&PARENT_NEWS_HG_CODE=&selectPage=81)도 확인했다.
- [경상북도 민물고기연구센터: 초어](https://www.gb.go.kr/Main/page.do?BD_CODE=shape_01&B_NUM=35684900&cmd=2&mnu_uid=15850): 국명·학명 및 유선형 체형 확인.

## 게임 설정

체장 분포·미끼 선호·수심·무게·힘·등급 문턱·시세·맵 출현율은 게임 밸런스이며 공식 어종 기록이나 실측 생태 수치가 아니다. 모든 복셀 그림은 별도로 작성했다.

| ID | 이름 | 최대 길이 | 최대 무게 | 준대물 / 대물 / 초대물 / 전설급 |
|---|---|---:|---:|---|
| hera | 떡붕어 | 60cm | 3.888kg | 32 / 40 / 50 / 58cm |
| nuchi | 누치 | 75cm | 3.797kg | 45 / 55 / 65 / 72cm |
| koi | 비단잉어 | 100cm | 12kg | 65 / 80 / 90 / 98cm |
| leather | 가죽잉어 | 100cm | 18.5kg | 65 / 80 / 90 / 98cm |
| bredmirror | 육종향어 | 100cm | 21.5kg | 70 / 85 / 94 / 99cm |
| grasscarp | 초어 | 110cm | 16.638kg | 75 / 90 / 100 / 108cm |

떡붕어는 중층 글루텐, 누치는 바닥 생미끼, 비단잉어는 옥수수·곡물, 가죽잉어·육종향어는 바닥 어분, 초어는 옥수수·곡물로 구분한다. 기본 버들못에 6개 모두 낮은 밀도로 등장하고, 다른 낚시터는 기존 입장 잠금을 유지한다. 새 ID는 순위 저장 허용 목록·길이 한도와 함께 등록한다.

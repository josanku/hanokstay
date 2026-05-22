#!/usr/bin/env python3
"""
data.go.kr 지방행정인허가데이터(LOCALDATA)에서 한옥체험업 데이터를 가져와
/data/hanokstay.json 형식으로 변환·저장.

[사전 준비]
1. https://www.data.go.kr 회원가입 후 "지방행정인허가데이터" OpenAPI 활용신청
   - 검색 키워드: "지방행정인허가" 또는 "한옥체험업"
   - 한옥체험업 단일 데이터셋명: 「행정안전부_지방행정 인허가 데이터 - 한옥체험업」
2. 발급받은 인증키(serviceKey)를 환경변수로 설정:
   export DATA_GO_KR_KEY="발급받은_serviceKey"
3. 카카오 좌표 변환을 사용하려면 (선택):
   export KAKAO_REST_KEY="카카오_REST_KEY"

[실행]
python3 scripts/fetch_localdata.py --out data/hanokstay.json

[참고]
- 한옥체험업 데이터의 opnSvcId 는 지방행정인허가시스템 기준 "한옥체험업"으로 매핑됨.
- API 응답이 변경될 수 있으므로 data.go.kr 의 데이터 명세서 최신본 확인 필수.
"""

import argparse
import json
import os
import sys
import time
from urllib.parse import urlencode
from urllib.request import urlopen, Request

# 지방행정인허가데이터 표준 OpenAPI
# 한옥체험업 단일 서비스 명세는 data.go.kr 활용신청 후 응답되는 URL 사용
# 표준 API URL 패턴 (참고):
BASE_URL = "http://apis.data.go.kr/B553077/api/open/sdsc2"
ENDPOINT = "/storeListInRadius"  # 예시. 한옥체험업 전용 endpoint 가 별도 발급되면 교체

# 일반적으로 한옥체험업은 다음 endpoint 패턴:
# http://www.localdata.go.kr/platform/rest/TO0/openDataApi?authKey=XXX&opnSvcId=07_22_21_P&...
LOCALDATA_BASE = "http://www.localdata.go.kr/platform/rest/TO0/openDataApi"
OPN_SVC_ID = "07_22_21_P"  # 한옥체험업 (참고: 시스템 폐쇄 가능, data.go.kr 명세 확인)


def fetch_pages(auth_key: str, opn_svc_id: str = OPN_SVC_ID, page_size: int = 500):
    """LOCALDATA OpenAPI 페이지네이션 수집. 폐쇄 시 data.go.kr 신규 endpoint 로 교체."""
    page = 1
    results = []
    while True:
        params = {
            "authKey": auth_key,
            "opnSvcId": opn_svc_id,
            "pageIndex": page,
            "pageSize": page_size,
            "resultType": "json",
        }
        url = f"{LOCALDATA_BASE}?{urlencode(params)}"
        print(f"  fetching page {page} ...", file=sys.stderr)
        req = Request(url, headers={"User-Agent": "Hanokstay-Wehome/1.0"})
        try:
            with urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
        except Exception as e:
            print(f"!! fetch failed: {e}", file=sys.stderr)
            break
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            print(f"!! non-JSON response: {raw[:500]}", file=sys.stderr)
            break
        rows = (
            payload.get("result", {}).get("body", {}).get("rows", [{}])[0].get("row", [])
        )
        if not rows:
            break
        results.extend(rows)
        if len(rows) < page_size:
            break
        page += 1
        time.sleep(0.3)
    return results


def normalize_row(row: dict) -> dict:
    """LOCALDATA 표준 응답 컬럼명을 hanokstay.json 스키마로 매핑."""
    sido = row.get("siteWhlAddr", "").split(" ")[0] if row.get("siteWhlAddr") else ""
    sigungu = (
        " ".join(row.get("siteWhlAddr", "").split(" ")[1:3])
        if row.get("siteWhlAddr")
        else ""
    )
    return {
        "id": row.get("mgtNo") or row.get("opnsfTeamCode"),
        "name": row.get("bplcNm"),
        "name_en": "",
        "address": row.get("siteWhlAddr") or row.get("rdnWhlAddr"),
        "sido": sido,
        "sigungu": sigungu,
        "lat": _to_float(row.get("y")),
        "lng": _to_float(row.get("x")),
        "license_type": "한옥체험업",
        "license_number": row.get("mgtNo"),
        "registered_date": row.get("apvPermYmd") or row.get("ldCobDtm"),
        "rooms": _to_int(row.get("roomCnt")),
        "max_guests": None,
        "shape": None,
        "roof": None,
        "village_cluster": None,
        "kto_certified": False,
        "kto_meongpum": False,
        "cultural_property": None,
        "experiences": [],
        "raw_status": row.get("trdStateNm"),
    }


def _to_float(v):
    try:
        return float(v) if v not in (None, "", "0") else None
    except (TypeError, ValueError):
        return None


def _to_int(v):
    try:
        return int(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def build_stats(listings: list) -> dict:
    """집계 통계 생성: 시도·라이선스·평면형·지붕·연도별."""
    from collections import Counter

    sido_counts = Counter(l["sido"] for l in listings if l.get("sido"))
    total = sum(sido_counts.values()) or 1
    by_sido = [
        {"sido": s, "count": c, "share": round(c / total, 3)}
        for s, c in sido_counts.most_common()
    ]

    license_counts = Counter(
        l.get("license_type", "한옥체험업") for l in listings
    )
    by_license_type = [
        {"type": k, "count": v, "share": round(v / total, 3)}
        for k, v in license_counts.items()
    ]

    return {
        "by_sido": by_sido,
        "by_license_type": by_license_type,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/hanokstay.json")
    parser.add_argument("--opn-svc-id", default=OPN_SVC_ID)
    args = parser.parse_args()

    key = os.environ.get("DATA_GO_KR_KEY") or os.environ.get("LOCALDATA_KEY")
    if not key:
        print(
            "ERROR: DATA_GO_KR_KEY (또는 LOCALDATA_KEY) 환경변수 필요. data.go.kr 에서 발급받으세요.",
            file=sys.stderr,
        )
        sys.exit(2)

    print("Fetching 한옥체험업 from LOCALDATA / data.go.kr ...", file=sys.stderr)
    rows = fetch_pages(key, args.opn_svc_id)
    print(f"Fetched {len(rows)} rows.", file=sys.stderr)

    listings = [normalize_row(r) for r in rows]
    listings = [l for l in listings if l.get("name")]

    output = {
        "meta": {
            "source": f"data.go.kr / LOCALDATA opnSvcId={args.opn_svc_id}",
            "as_of": time.strftime("%Y-%m-%d"),
            "fetched_count": len(listings),
        },
        "stats": build_stats(listings),
        "listings": listings,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Wrote {args.out} ({len(listings)} listings)", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8080"
COOKIE="/tmp/admin.txt"
BID=""
S2=""
F1=""
F2=""

say() { printf "\n\033[1;34m== %s ==\033[0m\n" "$*"; }

say "health"
curl -sf "$BASE/api/health" | jq -e '.status == "ok"' >/dev/null
echo "OK"

say "db"
curl -sf "$BASE/api/health/db" | jq -e '.tables == 6' >/dev/null
echo "OK"

say "login admin"
curl -sf -c "$COOKIE" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -e '.username == "admin"' >/dev/null
echo "OK"

say "create building"
BID=$(curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings" \
  -H "Content-Type: application/json" \
  -d '{"name":"Тест","description":""}' | jq -r '.id')
echo "BID=$BID"

say "create floors"
F1=$(curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings/$BID/floors" \
  -H "Content-Type: application/json" \
  -d '{"name":"1","level":1,"svg":"<svg xmlns=\"http://www.w3.org/2000/svg\"/>","vb":[0,0,10,10]}' \
  | jq -r '.id')
F2=$(curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings/$BID/floors" \
  -H "Content-Type: application/json" \
  -d '{"name":"2","level":2,"svg":"<svg xmlns=\"http://www.w3.org/2000/svg\"/>","vb":[0,0,10,10]}' \
  | jq -r '.id')
echo "F1=$F1 F2=$F2"

say "create scenarios"
S1=$(curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings/$BID/scenarios" \
  -H "Content-Type: application/json" \
  -d '{"name":"Базовый","params":null,"fire":null}' | jq -r '.id')
S2=$(curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings/$BID/scenarios" \
  -H "Content-Type: application/json" \
  -d '{"name":"Пожар","params":null,"fire":null}' | jq -r '.id')
echo "S1=$S1 S2=$S2"

say "create 3 marks"
curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings/$BID/scenarios/$S2/marks" \
  -H "Content-Type: application/json" \
  -d "{\"floorId\":$F1,\"kind\":\"stair\",\"x\":10,\"y\":20,\"width\":1.2}" >/dev/null
curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings/$BID/scenarios/$S2/marks" \
  -H "Content-Type: application/json" \
  -d "{\"floorId\":$F1,\"kind\":\"exit\",\"x\":90,\"y\":90,\"width\":2.0}" >/dev/null
curl -sf -b "$COOKIE" -X POST "$BASE/api/buildings/$BID/scenarios/$S2/marks" \
  -H "Content-Type: application/json" \
  -d "{\"floorId\":$F2,\"kind\":\"spawn\",\"x\":50,\"y\":50}" >/dev/null

say "check 3 marks in list"
N=$(curl -sf -b "$COOKIE" "$BASE/api/buildings/$BID/scenarios/$S2/marks" | jq 'length')
[ "$N" = "3" ] && echo "OK" || { echo "FAIL: $N"; exit 1; }

say "check 3 marks in scenario"
N=$(curl -sf -b "$COOKIE" "$BASE/api/buildings/$BID/scenarios/$S2" | jq '.marks | length')
[ "$N" = "3" ] && echo "OK" || { echo "FAIL: $N"; exit 1; }

say "update mark 1"
NEW_X=$(curl -sf -b "$COOKIE" -X PUT "$BASE/api/buildings/$BID/scenarios/$S2/marks/1" \
  -H "Content-Type: application/json" \
  -d "{\"floorId\":$F1,\"kind\":\"stair\",\"x\":15,\"y\":25,\"width\":1.5}" | jq '.x')
[ "$NEW_X" = "15" ] && echo "OK" || { echo "FAIL: $NEW_X"; exit 1; }

say "delete one mark"
curl -sf -o /dev/null -b "$COOKIE" -X DELETE "$BASE/api/buildings/$BID/scenarios/$S2/marks/3"
N=$(curl -sf -b "$COOKIE" "$BASE/api/buildings/$BID/scenarios/$S2/marks" | jq 'length')
[ "$N" = "2" ] && echo "OK" || { echo "FAIL: $N"; exit 1; }

say "delete all marks"
curl -sf -o /dev/null -b "$COOKIE" -X DELETE "$BASE/api/buildings/$BID/scenarios/$S2/marks"
N=$(curl -sf -b "$COOKIE" "$BASE/api/buildings/$BID/scenarios/$S2/marks" | jq 'length')
[ "$N" = "0" ] && echo "OK" || { echo "FAIL: $N"; exit 1; }

say "ALL OK"
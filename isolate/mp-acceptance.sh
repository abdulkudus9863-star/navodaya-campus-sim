#!/usr/bin/env bash
# Integration run for the multiplayer backend against the dev deployment.
set -u
cd /home/daytona/codebase

PASS=0
FAIL=0
note() { printf '\n\033[1m%s\033[0m\n' "$1"; }
pass() { PASS=$((PASS+1)); printf '  PASS  %s\n' "$1" >&2; }
fail() { FAIL=$((FAIL+1)); printf '  FAIL  %s\n' "$1" >&2; }

ident() { printf '{"subject":"%s","issuer":"test","tokenIdentifier":"test|%s"}' "$1" "$1"; }

run() {
  local out code attempt
  for attempt in 1 2 3 4 5 6; do
    out=$(bunx convex run "$@" 2>&1); code=$?
    if ! printf '%s' "$out" | grep -q "MissingAccessToken"; then
      printf '%s' "$out"
      return $code
    fi
    sleep 2
  done
  printf '%s' "$out"
  return $code
}

expect_ok() { # name, then command
  local name="$1"; shift
  local out; out=$(run "$@"); local code=$?
  if [ $code -eq 0 ]; then pass "$name"; else fail "$name :: $out"; fi
  printf '%s' "$out"
}

expect_err() { # name, substring, command
  local name="$1"; local needle="$2"; shift 2
  local out; out=$(run "$@"); local code=$?
  if [ $code -ne 0 ] && printf '%s' "$out" | grep -qi -- "$needle"; then
    pass "$name"
  else
    fail "$name :: exit=$code :: $out"
  fi
}

expect_json() { # name, jq filter, expected, json
  local name="$1" filter="$2" expected="$3" json="$4"
  local actual; actual=$(printf '%s' "$json" | jq -r "$filter" 2>/dev/null)
  if [ "$actual" = "$expected" ]; then pass "$name"; else fail "$name :: expected=$expected actual=$actual"; fi
}

note "Reset test data"
run mpTest:purge >/dev/null
SEED=$(run mpTest:seedUsers '{"count":5}')
A=$(printf '%s' "$SEED" | jq -r '.[0]')
B=$(printf '%s' "$SEED" | jq -r '.[1]')
C=$(printf '%s' "$SEED" | jq -r '.[2]')
D=$(printf '%s' "$SEED" | jq -r '.[3]')
E=$(printf '%s' "$SEED" | jq -r '.[4]')
echo "users: A=$A B=$B C=$C D=$D E=$E"

IA=$(ident "$A"); IB=$(ident "$B"); IC=$(ident "$C"); ID=$(ident "$D"); IE=$(ident "$E")

note "1. Room creation, codes and membership"
OUT=$(expect_ok "A creates a room" multiplayer:createRoom '{"name":"Aarav Test","houseId":"aravali","characterId":"ARV-001"}' --identity "$IA")
ROOM=$(printf '%s' "$OUT" | jq -r '.roomId')
CODE=$(printf '%s' "$OUT" | jq -r '.code')
[ -n "$ROOM" ] && [ "$ROOM" != "null" ] && pass "room id returned: $ROOM" || fail "room id missing"
[ ${#CODE} -eq 6 ] && pass "six-character room code: $CODE" || fail "bad code: $CODE"

expect_ok "B joins with code" multiplayer:joinRoom "{\"code\":\"$CODE\",\"name\":\"Bela Test\",\"houseId\":\"nilgiri\",\"characterId\":\"NIL-001\"}" --identity "$IB" >/dev/null
expect_ok "C joins with code" multiplayer:joinRoom "{\"code\":\"$CODE\",\"name\":\"Chetan Test\",\"houseId\":\"shivalik\",\"characterId\":\"SHV-001\"}" --identity "$IC" >/dev/null
expect_ok "D joins with code" multiplayer:joinRoom "{\"code\":\"$CODE\",\"name\":\"Divya Test\",\"houseId\":\"udaygiri\",\"characterId\":\"UDY-001\"}" --identity "$ID" >/dev/null
expect_err "fifth player is rejected (capacity 4)" "full" multiplayer:joinRoom "{\"code\":\"$CODE\",\"name\":\"Esha Test\",\"houseId\":\"aravali\",\"characterId\":\"ARV-002\"}" --identity "$IE"
expect_err "wrong room code is rejected" "No room uses that code" multiplayer:joinRoom '{"code":"ZZZZZZ","name":"Esha Test","houseId":"aravali","characterId":"ARV-002"}' --identity "$IE"

note "2. Access control and privacy"
OUT=$(expect_ok "anonymous room query is refused" multiplayer:room "{\"roomId\":\"$ROOM\"}")
expect_json "anonymous gets no room data" '.' 'null' "$OUT"
OUT=$(expect_ok "non-member room query returns nothing" multiplayer:room "{\"roomId\":\"$ROOM\"}" --identity "$IE")
expect_json "non-member sees null" '.' 'null' "$OUT"
expect_err "non-member cannot send chat" "not a member" multiplayer:sendMessage "{\"roomId\":\"$ROOM\",\"text\":\"hello\"}" --identity "$IE"
expect_err "non-member cannot move in room" "not a member" multiplayer:syncPlayer "{\"roomId\":\"$ROOM\",\"x\":0,\"y\":0,\"z\":0,\"rotationY\":0,\"moving\":false,\"crouching\":false,\"anim\":\"idle\"}" --identity "$IE"
expect_err "non-member cannot report a message" "not a member" multiplayer:reportMessage "{\"roomId\":\"$ROOM\",\"messageId\":\"kh7fkb8cbxqmegwvd0h3fa0rjd8j65t4\",\"reason\":\"x\"}" --identity "$IE"

note "3. Host-only start and room state"
expect_err "non-host cannot start" "Only the host" multiplayer:startMission "{\"roomId\":\"$ROOM\"}" --identity "$IB"
OUT=$(expect_ok "B marks ready" multiplayer:setReady "{\"roomId\":\"$ROOM\",\"ready\":true}" --identity "$IB")
OUT=$(expect_ok "host starts the mission" multiplayer:startMission "{\"roomId\":\"$ROOM\"}" --identity "$IA")
expect_json "mission started" '.started' 'true' "$OUT"
expect_err "late join during mission is blocked" "already started" multiplayer:joinRoom "{\"code\":\"$CODE\",\"name\":\"Esha Test\",\"houseId\":\"aravali\",\"characterId\":\"ARV-002\"}" --identity "$IE"

note "4. Server-authoritative movement and collection"
expect_ok "A syncs position at crate 1" multiplayer:syncPlayer "{\"roomId\":\"$ROOM\",\"x\":-41.8,\"y\":0,\"z\":23.4,\"rotationY\":1.5,\"moving\":true,\"crouching\":false,\"anim\":\"walk\"}" --identity "$IA" >/dev/null
expect_err "B cannot collect from across the garden" "need to be at the crate" multiplayer:collectVegetable "{\"roomId\":\"$ROOM\",\"itemId\":\"veg-1\",\"x\":-38,\"z\":33.4}" --identity "$IB"
expect_ok "B syncs position at crate 1" multiplayer:syncPlayer "{\"roomId\":\"$ROOM\",\"x\":-41.8,\"y\":0,\"z\":23.4,\"rotationY\":1.5,\"moving\":false,\"crouching\":false,\"anim\":\"idle\"}" --identity "$IB" >/dev/null
OUT=$(expect_ok "A collects crate 1" multiplayer:collectVegetable "{\"roomId\":\"$ROOM\",\"itemId\":\"veg-1\",\"x\":-41.8,\"z\":23.4}" --identity "$IA")
expect_json "team count is 1" '.collected' '1' "$OUT"
expect_err "B cannot claim the same crate" "already collected" multiplayer:collectVegetable "{\"roomId\":\"$ROOM\",\"itemId\":\"veg-1\",\"x\":-41.8,\"z\":23.4}" --identity "$IB"
expect_err "unknown crate is rejected" "Unknown vegetable" multiplayer:collectVegetable "{\"roomId\":\"$ROOM\",\"itemId\":\"veg-99\",\"x\":-41.8,\"z\":23.4}" --identity "$IA"

note "5. Shared objective, safe-zone return and rewards"
for entry in "veg-2:-40.9:25.6" "veg-3:-39.6:23.0" "veg-4:-38.2:24.2" "veg-5:-36.9:22.8" "veg-6:-35.2:24.3"; do
  ITEM=${entry%%:*}; REST=${entry#*:}; X=${REST%%:*}; Z=${REST##*:}
  expect_ok "A collects $ITEM" multiplayer:syncPlayer "{\"roomId\":\"$ROOM\",\"x\":$X,\"y\":0,\"z\":$Z,\"rotationY\":0,\"moving\":true,\"crouching\":false,\"anim\":\"walk\"}" --identity "$IA" >/dev/null
  expect_ok "A claims $ITEM" multiplayer:collectVegetable "{\"roomId\":\"$ROOM\",\"itemId\":\"$ITEM\",\"x\":$X,\"z\":$Z}" --identity "$IA" >/dev/null
done
expect_err "return before 10 crates is rejected" "Collect all ten" multiplayer:returnToSafeArea "{\"roomId\":\"$ROOM\",\"x\":-38,\"z\":31.8}" --identity "$IA"
for entry in "veg-7:-42.1:27.4" "veg-8:-39.5:28.0" "veg-9:-36.6:27.6" "veg-10:-34.2:26.4"; do
  ITEM=${entry%%:*}; REST=${entry#*:}; X=${REST%%:*}; Z=${REST##*:}
  expect_ok "B collects $ITEM" multiplayer:syncPlayer "{\"roomId\":\"$ROOM\",\"x\":$X,\"y\":0,\"z\":$Z,\"rotationY\":0,\"moving\":true,\"crouching\":false,\"anim\":\"walk\"}" --identity "$IB" >/dev/null
  expect_ok "B claims $ITEM" multiplayer:collectVegetable "{\"roomId\":\"$ROOM\",\"itemId\":\"$ITEM\",\"x\":$X,\"z\":$Z}" --identity "$IB" >/dev/null
done
expect_err "return outside safe area is rejected" "safe area" multiplayer:returnToSafeArea "{\"roomId\":\"$ROOM\",\"x\":0,\"z\":0}" --identity "$IB"
OUT=$(expect_ok "B completes at the garden gate" multiplayer:returnToSafeArea "{\"roomId\":\"$ROOM\",\"x\":-38,\"z\":31.8}" --identity "$IB")
expect_json "team completion granted" '.teamXp' '60' "$OUT"
expect_err "double completion is rejected" "not running" multiplayer:returnToSafeArea "{\"roomId\":\"$ROOM\",\"x\":-38,\"z\":31.8}" --identity "$IA"

OUT=$(expect_ok "A multiplayer progress" multiplayer:myProgress --identity "$IA")
expect_json "A received 6 crate XP + 60 team XP" '.xp' '120' "$OUT"
expect_json "A crate count" '.vegetables' '6' "$OUT"
expect_json "A mission count" '.missions' '1' "$OUT"
OUT=$(expect_ok "B multiplayer progress" multiplayer:myProgress --identity "$IB")
expect_json "B received 4 crate XP + team XP" '.xp' '100' "$OUT"
expect_json "B crate count" '.vegetables' '4' "$OUT"
OUT=$(expect_ok "C multiplayer progress" multiplayer:myProgress --identity "$IC")
expect_json "C (idle teammate) received team XP" '.xp' '60' "$OUT"

OUT=$(expect_ok "A reads the completed room" multiplayer:room "{\"roomId\":\"$ROOM\"}" --identity "$IA")
expect_json "room is completed" '.status' 'completed' "$OUT"
expect_json "mission success" '.missionSuccess' 'true' "$OUT"
expect_json "ten collected" '.collected | length' '10' "$OUT"

note "6. Room chat, rate limits and reporting"
expect_ok "B sends a chat message" multiplayer:sendMessage "{\"roomId\":\"$ROOM\",\"text\":\"Meet at the gate\"}" --identity "$IB" >/dev/null
OUT=$(expect_ok "A reads room chat" multiplayer:messages "{\"roomId\":\"$ROOM\"}" --identity "$IA")
expect_json "one message visible to members" 'length' '1' "$OUT"
expect_json "message text intact" '.[0].text' 'Meet at the gate' "$OUT"
MSG=$(printf '%s' "$OUT" | jq -r '.[0].messageId')
OUT=$(expect_ok "non-member sees no room chat" multiplayer:messages "{\"roomId\":\"$ROOM\"}" --identity "$IE")
expect_json "non-member messages empty" 'length' '0' "$OUT"
expect_ok "HTML payload is sanitized on write" multiplayer:sendMessage "{\"roomId\":\"$ROOM\",\"text\":\"<script>alert(1)</script>\"}" --identity "$IC" >/dev/null
OUT=$(run multiplayer:messages "{\"roomId\":\"$ROOM\"}" --identity "$IC")
if printf '%s' "$OUT" | grep -q '<script>'; then fail "script tag was stored verbatim"; else pass "script tag stripped from stored chat"; fi
for i in 2 3 4 5 6; do
  run multiplayer:sendMessage "{\"roomId\":\"$ROOM\",\"text\":\"flood $i\"}" --identity "$IB" >/dev/null
done
expect_err "chat rate limit stops the seventh message" "Slow down" multiplayer:sendMessage "{\"roomId\":\"$ROOM\",\"text\":\"flood 7\"}" --identity "$IB"
OUT=$(expect_ok "A reports B's message" multiplayer:reportMessage "{\"roomId\":\"$ROOM\",\"messageId\":\"$MSG\",\"reason\":\"QA report\"}" --identity "$IA")
expect_json "report recorded" '.reported' 'true' "$OUT"
OUT=$(expect_ok "duplicate report is idempotent" multiplayer:reportMessage "{\"roomId\":\"$ROOM\",\"messageId\":\"$MSG\",\"reason\":\"QA report\"}" --identity "$IA")
expect_json "duplicate report accepted once" '.reported' 'true' "$OUT"
expect_err "cannot report your own message" "your own" multiplayer:reportMessage "{\"roomId\":\"$ROOM\",\"messageId\":\"$MSG\",\"reason\":\"self\"}" --identity "$IB"

note "7. Host leave, host transfer and empty-room closure"
OUT=$(expect_ok "C creates room 2" multiplayer:createRoom '{"name":"Chetan Test","houseId":"shivalik","characterId":"SHV-001"}' --identity "$IC")
ROOM2=$(printf '%s' "$OUT" | jq -r '.roomId'); CODE2=$(printf '%s' "$OUT" | jq -r '.code')
expect_ok "D joins room 2" multiplayer:joinRoom "{\"code\":\"$CODE2\",\"name\":\"Divya Test\",\"houseId\":\"udaygiri\",\"characterId\":\"UDY-001\"}" --identity "$ID" >/dev/null
expect_ok "host C leaves room 2" multiplayer:leaveRoom "{\"roomId\":\"$ROOM2\"}" --identity "$IC" >/dev/null
OUT=$(expect_ok "D reads room 2 after host left" multiplayer:room "{\"roomId\":\"$ROOM2\"}" --identity "$ID")
expect_json "D is promoted to host" '.isHost' 'true' "$OUT"
expect_json "room 2 is still waiting, not corrupted" '.status' 'waiting' "$OUT"

OUT=$(expect_ok "A creates room 3" multiplayer:createRoom '{"name":"Aarav Test","houseId":"aravali","characterId":"ARV-001"}' --identity "$IA")
ROOM3=$(printf '%s' "$OUT" | jq -r '.roomId'); CODE3=$(printf '%s' "$OUT" | jq -r '.code')
expect_ok "A leaves empty room 3" multiplayer:leaveRoom "{\"roomId\":\"$ROOM3\"}" --identity "$IA" >/dev/null
expect_err "joining a closed room is rejected" "closed" multiplayer:joinRoom "{\"code\":\"$CODE3\",\"name\":\"Esha Test\",\"houseId\":\"aravali\",\"characterId\":\"ARV-002\"}" --identity "$IE"

note "8. Stale presence expiry (waiting room)"
run mpTest:purge >/dev/null
SEED=$(run mpTest:seedUsers '{"count":2}')
A=$(printf '%s' "$SEED" | jq -r '.[0]'); B=$(printf '%s' "$SEED" | jq -r '.[1]')
IA=$(ident "$A"); IB=$(ident "$B")
OUT=$(run multiplayer:createRoom '{"name":"Aarav Test","houseId":"aravali","characterId":"ARV-001"}' --identity "$IA")
ROOM4=$(printf '%s' "$OUT" | jq -r '.roomId'); CODE4=$(printf '%s' "$OUT" | jq -r '.code')
run multiplayer:joinRoom "{\"code\":\"$CODE4\",\"name\":\"Bela Test\",\"houseId\":\"nilgiri\",\"characterId\":\"NIL-001\"}" --identity "$IB" >/dev/null
run mpTest:ageAll '{}' >/dev/null
run multiplayer:cleanup '{}' >/dev/null
OUT=$(run multiplayer:room "{\"roomId\":\"$ROOM4\"}" --identity "$IA")
if [ "$(printf '%s' "$OUT" | jq -r '. // "gone"' 2>/dev/null)" = "gone" ] || [ -z "$(printf '%s' "$OUT" | jq -r '.status // empty' 2>/dev/null)" ]; then
  pass "abandoned waiting room expired after stale presence"
else
  fail "abandoned room still active: $OUT"
fi

note "Result"
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
run mpTest:purge >/dev/null
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)

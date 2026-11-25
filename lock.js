/* 사옥 내부 화면 잠금 (개발 25, 2026-11-25). 보안 02 규격.
 * - 암호는 브라우저 표준 Web Crypto(crypto.subtle)만 쓴다. 남의 라이브러리 없음.
 * - v1 상자: 비밀번호 → PBKDF2-HMAC-SHA256 600,000번(소금 16바이트) → AES-GCM 256(IV 12바이트)
 * - v2 상자(보안 2-4 두 겹): 팀은 공개 열쇠로만 잠근다. ECDH P-256 → HKDF-SHA256 → AES-GCM 256.
 *   푸는 열쇠(개인 열쇠)는 key.enc 에 v1 방식으로 대표님 비밀번호로 잠겨 있다.
 * - 비밀번호·풀린 내용은 localStorage·쿠키·sessionStorage 에 넣지 않는다. 메모리에만.
 * - 답(개발 26, 보안 04): key.enc 안에 대표님 토큰(fine-grained, 저장소 하나·Issues 쓰기)이 있으면 api.github.com 으로 바로 이슈를 만든다.
 *   토큰은 이 파일의 닫힌 변수에만 있다(window·저장소·콘솔·주소에 없음). 없거나 실패하면 "새 이슈" 화면 방식으로 물러난다.
 * - 15분 손대지 않거나 탭을 닫으면 잠근다(개인 열쇠·토큰을 지움).
 * 쓰는 법 (디자인 index.html 에서):
 *   <script src="lock.js" charset="utf-8"></script>  그리고 대표실 단추에서  OfficeLock.open()
 *   풀리면 window.office.load(state) 를 부른다. 없으면 잠금 칸 안에 글로만 보여 준다.
 */
(function (g) {
	"use strict";
	var ITER = 600000;
	var INFO = "dajeongdagam-office v2";
	var CFG = {
		boxUrl: "office.enc",          // 잠긴 상자 (v1 또는 v2)
		keyUrl: "key.enc",             // v2 일 때만: 비밀번호로 잠근 푸는 열쇠
		refreshMs: 90000,              // 1분 30초마다 상자를 다시 받는다
		idleMs: 15 * 60 * 1000         // 손대지 않으면 잠그는 때 (15분보다 길게는 못 함)
	};
	// 답 저장소: 코드에 고정 (보안 04 5-3, 설정으로 바꿀 수 없음)
	var REPO = "hd979796/dajeongdagam-office-private";
	var API = "https://api.github.com/repos/" + REPO;
	var IDLE_MAX = 15 * 60 * 1000;
	var MARK = "\n\n— 사옥에서 보냄";                // 본문 끝 표시 (보안 04 3절: 팀이 믿는 조건)
	var TOKEN_RE = /^github_pat_[A-Za-z0-9_]{50,255}$/;   // fine-grained 토큰만 (옛 ghp_ 거절)
	var subtle = g.crypto && g.crypto.subtle;

	// ---------------------------------------------------------------- 걸러내기 목록 (보안 03 고칠 줄 3: 이 한 곳. lock_make.html 도 이것을 쓴다)
	// 사옥_잠그기.py 의 BAD 와 글자까지 같아야 한다 (시험이 대조한다)
	var BAD = [
		[/sk-[A-Za-z0-9_-]{16,}/, "API 키 꼴(sk-)"],
		[/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}/, "GitHub 토큰 꼴"],
		[/AIza[0-9A-Za-z_-]{30,}/, "Google 키 꼴"],
		[/msy_[A-Za-z0-9]{16,}/, "메쉬 키 꼴"],
		[/01[016789][- .]?\d{3,4}[- .]?\d{4}/, "휴대폰 번호 꼴"],
		[/\d{6}[- ]?[1-4]\d{6}/, "주민번호 꼴"]
	];
	function badIn(text) {
		for (var i = 0; i < BAD.length; i++) if (BAD[i][0].test(text)) return BAD[i][1];
		return "";
	}
	// 비밀번호 세기 (보안 03 고칠 줄 1 → 보안 04 4절로 올림. 사옥_잠그기.py 의 strong() 과 같은 규칙)
	//   무작위 20자 이상(서로 다른 글자 8개 이상), 또는 낱말 5개 이상(서로 다름, 각 2글자 이상, 띄어쓰기 빼고 14글자 이상)
	var BANNED = ["삼한제일", "다정다감", "dajeongdagam", "hd979796", "password", "비밀번호", "1234", "qwer"];
	function strong(pw) {
		pw = String(pw || "");
		var low = pw.toLowerCase();
		for (var i = 0; i < BANNED.length; i++) if (low.indexOf(BANNED[i]) >= 0) return false;
		var words = pw.trim().split(/\s+/).filter(Boolean);
		var uniq = {}, nU = 0;
		words.forEach(function (w) { if (!uniq[w]) { uniq[w] = 1; nU++; } });
		var byWords = words.length >= 5 && nU === words.length &&
			words.every(function (w) { return Array.from(w).length >= 2; }) &&
			Array.from(pw.replace(/\s+/g, "")).length >= 14;
		var chars = Array.from(pw);
		var byChars = chars.length >= 20 && new Set(chars).size >= 8;
		return byWords || byChars;
	}
	var te = new TextEncoder(), td = new TextDecoder();

	// ---------------------------------------------------------------- 바이트 ↔ base64
	function b64(bytes) {
		var u = new Uint8Array(bytes), s = "";
		for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
		return btoa(s);
	}
	function unb64(str) {
		var s = atob(String(str)), u = new Uint8Array(s.length);
		for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
		return u;
	}
	function rand(n) { return g.crypto.getRandomValues(new Uint8Array(n)); }

	// ---------------------------------------------------------------- v1: 비밀번호 상자
	async function pwKey(pw, salt, iter, use) {
		var base = await subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveKey"]);
		return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iter },
			base, { name: "AES-GCM", length: 256 }, false, [use]);
	}
	async function sealV1(bytes, pw) {
		var salt = rand(16), iv = rand(12);
		var k = await pwKey(pw, salt, ITER, "encrypt");
		var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, k, bytes);
		return JSON.stringify({ v: 1, alg: "PBKDF2-SHA256/AES-GCM-256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
	}
	async function openV1(box, pw) {
		if (box.v !== 1 || !(box.iter >= ITER)) throw new Error("form");   // 규격(600,000)보다 약한 상자는 받지 않는다 (보안 03 고칠 줄 2)
		var k = await pwKey(pw, unb64(box.salt), box.iter, "decrypt");
		return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.ct)));
	}

	// ---------------------------------------------------------------- v2: 공개 열쇠 상자 (보안 2-4)
	async function hkdfKey(priv, pub, salt, use) {
		var bits = await subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
		var base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
		return subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: salt, info: te.encode(INFO) },
			base, { name: "AES-GCM", length: 256 }, false, [use]);
	}
	function pubJwk(j) { return { kty: "EC", crv: "P-256", x: j.x, y: j.y, ext: true }; }
	async function importPub(j) {
		return subtle.importKey("jwk", pubJwk(j), { name: "ECDH", namedCurve: "P-256" }, false, []);
	}
	function tokenOk(t) { return TOKEN_RE.test(String(t || "")); }
	// 열쇠 한 쌍을 만든다 → { keyEnc: 비밀번호로 잠근 푸는 열쇠(+토큰)(글), pub: 공개 열쇠(글) }
	//   gh: 깃헙 토큰(없어도 됨). 있으면 key.enc 안에 같이 잠근다 (보안 04 5-1)
	async function makeKeys(pw, gh) {
		if (gh && !tokenOk(gh)) throw new Error("token");
		var kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
		var priv = await subtle.exportKey("jwk", kp.privateKey);
		var pub = await subtle.exportKey("jwk", kp.publicKey);
		var o = { kty: "EC", crv: "P-256", x: priv.x, y: priv.y, d: priv.d };
		if (gh) o.gh = gh;
		return { keyEnc: await sealV1(te.encode(JSON.stringify(o)), pw), pub: JSON.stringify(pubJwk(pub)) };
	}
	// 토큰만 바꾸기 (보안 04 5-2): 같은 열쇠 쌍, 같은 비밀번호, 새 토큰 → 새 key.enc 글. office_pub.json 은 그대로
	async function rekeyToken(keyEncText, pw, gh) {
		if (!tokenOk(gh)) throw new Error("token");
		var raw = await openV1(JSON.parse(keyEncText), pw);
		var o = JSON.parse(td.decode(raw)); raw.fill(0);
		o.gh = gh;
		var out = await sealV1(te.encode(JSON.stringify(o)), pw);
		o = null;
		return out;
	}
	// 비밀번호로 key.enc 를 푼다 → { priv: 꺼낼 수 없는 CryptoKey, gh: 토큰 글 또는 "" }
	async function unlockKeyBox(keyEncText, pw) {
		var raw = await openV1(JSON.parse(keyEncText), pw);
		var j = JSON.parse(td.decode(raw)); raw.fill(0);
		var key = await subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: j.x, y: j.y, d: j.d, ext: false },
			{ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
		var gh = tokenOk(j.gh) ? j.gh : "";
		j = null;
		return { priv: key, gh: gh };
	}
	async function unlockPrivate(keyEncText, pw) { return (await unlockKeyBox(keyEncText, pw)).priv; }
	// 토큰이 그 저장소에 닿는지 (lock_make·대표님_준비 에서 저장 전에 한 번). 돌려줌: HTTP 상태 수, 망 실패면 0, 꼴 틀림 -1
	async function checkToken(gh) {
		if (!tokenOk(gh)) return -1;
		try {
			var r = await fetch(API, { headers: { Authorization: "Bearer " + gh, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
			return r.status;
		} catch (e) { return 0; }
	}
	async function sealV2(bytes, pubText) {
		var recip = await importPub(JSON.parse(pubText));
		var eph = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
		var epk = await subtle.exportKey("jwk", eph.publicKey);
		var salt = rand(16), iv = rand(12);
		var k = await hkdfKey(eph.privateKey, recip, salt, "encrypt");
		var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, k, bytes);
		return JSON.stringify({ v: 2, alg: "ECDH-P256/HKDF-SHA256/AES-GCM-256", epk: { x: epk.x, y: epk.y },
			salt: b64(salt), iv: b64(iv), ct: b64(ct) });
	}
	async function openV2(box, priv) {
		if (box.v !== 2) throw new Error("form");
		var k = await hkdfKey(priv, await importPub(box.epk), unb64(box.salt), "decrypt");
		return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.ct)));
	}

	// 상자 글을 푼다. secret = { pw } (v1) 또는 { priv } (v2)
	async function openBox(text, secret) {
		var box = JSON.parse(text);
		if (box.v === 1) return openV1(box, secret.pw);
		if (box.v === 2) return openV2(box, secret.priv);
		throw new Error("form");
	}

	// ---------------------------------------------------------------- state 모양 확인
	function checkState(s) {
		if (!s || typeof s !== "object" || !Array.isArray(s.heads)) throw new Error("shape");
		s.heads.forEach(function (h) {
			if (typeof h.id !== "string") throw new Error("shape");
			if (h.status !== "work" && h.status !== "rest" && h.status !== "answering") h.status = "rest";   // answering: 대표 말에 답하는 중 (개발 26)
			if (!Array.isArray(h.msgs)) h.msgs = [];
		});
		if (s.todos != null && !Array.isArray(s.todos)) s.todos = [];   // 대표님 할 일 판 (개발 26, 대표님 11:51)
		return s;
	}

	// ---------------------------------------------------------------- 답 (보안 02 3절·03 3절·04 5절)
	var REPLY_MAX = 1000;     // 새 탭 방식으로 물러날 때 주소 길이 (한글 한 글자 9바이트 → 약 9KB)
	var REPLY_NOTE = "보내면 바로 갑니다. 5초 안에 되돌릴 수 있습니다.";   // 답 칸 옆에 보여 줄 한 줄
	var REPO_OK = /^hd979796\/[A-Za-z0-9_.-]+-private$/;          // 비공개 저장소 이름만 (고정 이름도 한 번 더 검사)
	// 보내면 안 되는 까닭을 글로 돌려준다. 보내도 되면 ""
	function replyProblem(text) {
		var body = String(text || "");
		if (!REPO_OK.test(REPO)) return "답 저장소 이름이 비공개 저장소가 아닙니다. 보내지 않습니다.";
		if (!body.trim()) return "답이 비어 있습니다.";
		if (Array.from(body).length > REPLY_MAX) return "답은 " + REPLY_MAX + "자까지입니다.";
		if (badIn(body)) return "키·전화번호는 답에 쓰지 마세요.";
		return "";
	}
	function cleanId(headId) { return String(headId).replace(/[^\w\uAC00-\uD7A3-]/g, "").slice(0, 40); }
	function replyTitle(headId) { return "[" + cleanId(headId) + "] 대표 답"; }
	function replyUrl(headId, text) {
		return "https://github.com/" + REPO + "/issues/new?title=" +
			encodeURIComponent(replyTitle(headId)) + "&body=" + encodeURIComponent(String(text || "") + MARK);
	}
	function emit(detail) {
		if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("office:reply", { detail: detail }));
	}
	function linkOpen(headId, text) { g.open(replyUrl(headId, text), "_blank", "noopener,noreferrer"); }
	// 보냄을 시작했으면 true (결과는 "office:reply" 소식과 알림 띠로). 막았으면 알림을 띄우고 false
	//   photos: preparePhoto 가 돌려준 것의 배열(있으면 사진 보내기. 보안 07)
	function onReply(headId, text, photos) {
		var list = Array.isArray(photos) ? photos.filter(Boolean) : [];
		if (list.length) return onReplyPhotos(headId, text, list);
		var why = replyProblem(text);
		if (why) { if (g.alert) g.alert(why); return false; }
		touch();
		if (mem && mem.gh) { postIssue(headId, String(text)); return true; }
		// 토큰이 없으면: 새 이슈 화면 (대표님이 깃헙에서 Submit)
		linkOpen(headId, text);
		emit({ headId: headId, text: text, state: "linked" });
		return true;
	}
	function ghHeaders(t) {
		return { Authorization: "Bearer " + t, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" };
	}
	// body: 이슈 본문(없으면 text). photos: 이미 올린 사진 [{path, sha}] — 이슈를 못 만들면 지우고, 되돌리기 때도 지운다
	async function postIssue(headId, text, body, photos) {
		var t = mem && mem.gh, r = null, pics = photos || [];
		try {
			r = t ? await fetch(API + "/issues", { method: "POST", headers: ghHeaders(t), body: JSON.stringify({ title: replyTitle(headId), body: String(body == null ? text : body) + MARK }) }) : null;
		} catch (e) { r = null; }
		t = null;
		if (r && r.status === 201) {
			var num = 0;
			try { num = (await r.json()).number | 0; } catch (e) { num = 0; }
			emit({ headId: headId, text: text, state: "sent", num: num });
			toastSent(headId, text, num, pics);
			return;
		}
		var gone = r && (r.status === 401 || r.status === 403 || r.status === 404);
		emit({ headId: headId, text: text, state: "failed" });
		if (pics.length) {
			// 사진은 깃헙 새 탭으로 못 옮긴다: 올린 사진을 지우고 알리기만 (반쪽짜리 쪽지 막기, 보안 07 4절 순서)
			await dropPhotos(headId, pics);
			toast((gone ? "토큰이 만료됐거나 지워졌습니다." : "보내지 못했습니다.") + " 사진은 지웠습니다. 다시 보내 주세요.", "", null, 8000);
			return;
		}
		toast((gone ? "토큰이 만료됐거나 지워졌습니다." : "보내지 못했습니다.") + " 깃헙 화면으로 보낼 수 있습니다.",
			"깃헙 화면으로 보내기", function () { linkOpen(headId, text); emit({ headId: headId, text: text, state: "linked" }); }, 15000);
	}
	// 보낸 뒤 5초 되돌리기 (보안 04 5-5): 그 이슈를 닫는다. 사진이 있으면 올린 파일도 지운다 (보안 07 3절 3)
	function toastSent(headId, text, num, photos) {
		var done = false, pics = photos || [];
		toast("보냈습니다" + (num ? " #" + num : "") + (pics.length ? " (사진 " + pics.length + "장)" : ""), "되돌리기", async function () {
			if (done) return; done = true;
			var t = mem && mem.gh, ok = false;
			if (t && num) {
				try {
					var r = await fetch(API + "/issues/" + num, { method: "PATCH", headers: ghHeaders(t), body: JSON.stringify({ state: "closed", state_reason: "not_planned" }) });
					ok = r.ok;
				} catch (e) { ok = false; }
			}
			t = null;
			if (ok && pics.length) ok = await dropPhotos(headId, pics);
			if (ok) { emit({ headId: headId, text: text, state: "undone", num: num }); toast("되돌렸습니다" + (num ? " (#" + num + " 닫음)" : ""), "", null, 3000); }
			else toast("되돌리지 못했습니다. 총괄이사에게 말씀해 주세요.", "", null, 6000);
		}, 5000);
	}

	// ---------------------------------------------------------------- 사진 보내기 (보안 07 4절. 개발 30)
	// 고른 사진을 줄여(EXIF 빠짐) 비공개 쪽지함에 파일로 올리고, 다 되면 이슈 본문에 경로를 적는다.
	// 하나라도 못 올리면 이슈를 만들지 않고 올린 것을 지운다. 출입증(Contents: write)이 있을 때만. 바깥 요청은 api.github.com 뿐.
	var PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
	var PHOTO_RAW_MAX = 25 * 1024 * 1024;        // 원본 25MB 넘으면 거절
	var PHOTO_SIDE = 1600;                       // 긴 변
	var PHOTO_QUAL = [0.85, 0.75, 0.6];          // 1.5MB 넘으면 차례로 낮춘다
	var PHOTO_MAX = 1.5 * 1024 * 1024;           // 올릴 크기
	var PHOTO_PER_SEND = 4;                      // 한 번에
	var PHOTO_DAY_MAX = 50;                      // 하루 (메모리 안 숫자, 저장 안 함)
	var PHOTO_WARN = "사진에 비밀번호·QR·고객 이름·전화번호·알림이 찍혀 있지 않은지 보고 보내 주세요.";
	var photoDay = { d: "", n: 0 };
	function photoErr(t) { var e = new Error(t); e.photo = true; return e; }
	function pad2(n) { return (n < 10 ? "0" : "") + n; }
	function dayKey(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
	function photoDept(headId) { return String(headId).replace(/[^A-Za-z0-9]/g, "").slice(0, 20) || "x"; }   // 경로·커밋 글에는 영문·숫자만
	function photoPath(headId, now) {
		var d = now || new Date(), az = "abcdefghijklmnopqrstuvwxyz0123456789", r = rand(4), s = "";
		for (var i = 0; i < 4; i++) s += az[r[i] % az.length];
		return "사진/" + dayKey(d) + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + "_" + photoDept(headId) + "_" + s + ".jpg";
	}
	function photoUrl(path) { return API + "/contents/" + String(path).split("/").map(encodeURIComponent).join("/"); }
	// 파일 하나 → {blob(JPEG, EXIF 없음), preview(data: 주소), w, h, size}. 못 쓰면 photo 표시가 붙은 Error
	async function preparePhoto(file) {
		if (!file || PHOTO_TYPES.indexOf(String(file.type || "").toLowerCase()) < 0) throw photoErr("이 꼴은 못 엽니다. 캡처(PNG)로 보내 주세요.");
		if (file.size > PHOTO_RAW_MAX) throw photoErr("사진이 너무 큽니다. 25MB까지 됩니다.");
		var bmp = null;
		try { bmp = await g.createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { bmp = null; }
		if (!bmp) throw photoErr("이 꼴은 못 엽니다. 캡처(PNG)로 보내 주세요.");
		var k = Math.min(1, PHOTO_SIDE / Math.max(bmp.width, bmp.height, 1));
		var w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
		var cv = document.createElement("canvas");
		cv.width = w; cv.height = h;
		var cx = cv.getContext("2d");
		cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);          // 비친 PNG 바탕은 흰색으로
		cx.drawImage(bmp, 0, 0, w, h);                           // 다시 그리면 EXIF(GPS·기기·시각)가 모두 빠진다
		if (bmp.close) bmp.close();
		var blob = null;
		for (var i = 0; i < PHOTO_QUAL.length; i++) {
			var q = PHOTO_QUAL[i];
			blob = await new Promise(function (res) { cv.toBlob(res, "image/jpeg", q); });
			if (blob && blob.size <= PHOTO_MAX) break;
			blob = null;
		}
		var preview = blob ? cv.toDataURL("image/jpeg", 0.8) : "";
		cv.width = 0; cv.height = 0;
		if (!blob) throw photoErr("줄여도 1.5MB가 넘어 보낼 수 없습니다. 화면 일부만 캡처해 주세요.");
		return { blob: blob, preview: preview, w: w, h: h, size: blob.size };
	}
	// 보내면 안 되는 까닭 (사진과 함께). 보내도 되면 ""
	function photoProblem(text, list, now) {
		var body = String(text || "");
		if (!REPO_OK.test(REPO)) return "답 저장소 이름이 비공개 저장소가 아닙니다. 보내지 않습니다.";
		if (Array.from(body).length > REPLY_MAX) return "답은 " + REPLY_MAX + "자까지입니다.";
		if (badIn(body)) return "키·전화번호는 답에 쓰지 마세요.";
		if (!list.length) return "사진이 없습니다.";
		if (list.length > PHOTO_PER_SEND) return "사진은 한 번에 " + PHOTO_PER_SEND + "장까지입니다.";
		for (var i = 0; i < list.length; i++) {
			var p = list[i];
			if (!p || !p.blob || !(p.blob.size > 0) || p.blob.size > PHOTO_MAX) return "사진을 다시 골라 주세요.";
		}
		var dk = dayKey(now || new Date());
		if (photoDay.d === dk && photoDay.n + list.length > PHOTO_DAY_MAX) return "오늘은 많이 보냈습니다. 사진은 하루 " + PHOTO_DAY_MAX + "장까지입니다.";
		if (!mem || !mem.gh) return "사진은 바로 보내기(출입증)가 있을 때만 보낼 수 있습니다. 글만 보내 주세요.";
		return "";
	}
	function onReplyPhotos(headId, text, list) {
		var why = photoProblem(text, list);
		if (why) { if (g.alert) g.alert(why); return false; }
		touch();
		var dk = dayKey(new Date());
		if (photoDay.d !== dk) photoDay = { d: dk, n: 0 };
		photoDay.n += list.length;          // 보내기를 시작할 때 센다 (단추가 되풀이돼도 50장에서 멈춤)
		sendPhotos(headId, String(text || ""), list);
		return true;
	}
	async function putPhoto(headId, blob) {
		var bytes = new Uint8Array(await blob.arrayBuffer());
		var content = b64(bytes);
		bytes = null;
		for (var n = 0; n < 3; n++) {
			var t = mem && mem.gh;
			if (!t) return { fail: 0 };                 // 그 사이 잠겼다 (15분 자동 잠금)
			var path = photoPath(headId), r = null;
			try {
				r = await fetch(photoUrl(path), { method: "PUT", headers: ghHeaders(t), body: JSON.stringify({ message: "사옥 사진: [" + photoDept(headId) + "]", content: content }) });
			} catch (e) { r = null; }
			t = null;
			if (r && (r.status === 201 || r.status === 200)) {
				var sha = "";
				try { var j = await r.json(); sha = String((j && j.content && j.content.sha) || ""); } catch (e) { sha = ""; }
				content = "";
				return { path: path, sha: sha };
			}
			if (!r || r.status !== 422) return { fail: r ? r.status : 0 };   // 422 = 같은 이름이 있다 → 이름을 다시
		}
		content = "";
		return { fail: 422 };
	}
	// 올린 사진을 지운다 (되돌리기·반쪽 막기). 다 지웠으면 true. 지워도 커밋 기록에는 남는다 (보안 07 3절 3)
	async function dropPhotos(headId, pics) {
		var all = true;
		for (var i = 0; i < pics.length; i++) {
			var p = pics[i], t = mem && mem.gh, ok = false;
			if (t && p.sha) {
				try {
					var r = await fetch(photoUrl(p.path), { method: "DELETE", headers: ghHeaders(t), body: JSON.stringify({ message: "사옥 사진 되돌림: [" + photoDept(headId) + "]", sha: p.sha }) });
					ok = r.ok;
				} catch (e) { ok = false; }
			}
			t = null;
			if (!ok) all = false;
		}
		return all;
	}
	async function sendPhotos(headId, text, list) {
		var put = [], fail = -1;
		for (var i = 0; i < list.length; i++) {
			var res = null;
			try { res = await putPhoto(headId, list[i].blob); } catch (e) { res = { fail: 0 }; }
			if (!res.path) { fail = res.fail; break; }
			put.push(res);
		}
		for (var k = 0; k < list.length; k++) { list[k].blob = null; list[k].preview = ""; }   // 원본·줄인 그림은 보낸 뒤 바로 버린다
		if (fail >= 0) {
			await dropPhotos(headId, put);
			emit({ headId: headId, text: text, state: "failed" });
			var perm = fail === 401 || fail === 403 || fail === 404;
			toast(perm ? "사진을 올리지 못했습니다. 출입증에 사진 권한(Contents: Read and write)이 있는지 봐 주세요. 보내지 않았습니다."
				: "사진을 올리지 못해 보내지 않았습니다. 다시 보내 주세요.", "", null, 10000);
			return;
		}
		var body = text + (text ? "\n\n" : "") + put.map(function (p) { return "사진: " + p.path; }).join("\n");
		await postIssue(headId, text, body, put);
	}

	// ---------------------------------------------------------------- 화면 (브라우저에서만)
	var mem = null;         // { pw } 또는 { priv, gh } — 이 닫힌 변수에만 (window·저장소에 없음)
	var lastAct = 0, idleTimer = 0;
	function touch() { lastAct = Date.now(); }
	function idleCheck() {
		if (mem && Date.now() - lastAct > Math.min(CFG.idleMs, IDLE_MAX)) lock("15분 동안 쓰지 않아 잠갔습니다. 비밀번호를 다시 넣어 주세요.");
	}
	var lastText = "";
	var timer = 0;
	var ui = null;

	async function fetchText(url) {
		var r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
		if (r.status === 404) throw new Error("nobox");   // 아직 상자를 올리지 않음 (개발 26)
		if (!r.ok) throw new Error("net");
		return r.text();
	}
	function office() { g.office = g.office || {}; return g.office; }
	function deliver(state) {
		var o = office();
		if (typeof o.load === "function") { o.load(state); hide(); }
		else fallback(state);
	}
	async function unlock(pw) {
		var text = await fetchText(CFG.boxUrl);
		var box = JSON.parse(text);
		var secret;
		if (box.v === 2) secret = await unlockKeyBox(await fetchText(CFG.keyUrl), pw);
		else secret = { pw: pw };
		var bytes = await openBox(text, secret);
		var state = checkState(JSON.parse(td.decode(bytes)));
		mem = secret; lastText = text; secret = null;
		touch();
		clearInterval(timer);
		timer = setInterval(refresh, CFG.refreshMs);
		clearInterval(idleTimer);
		idleTimer = setInterval(idleCheck, 5000);
		deliver(state);
	}
	async function refresh() {
		if (!mem) return;
		try {
			var text = await fetchText(CFG.boxUrl);
			if (text === lastText) return;
			var state = checkState(JSON.parse(td.decode(await openBox(text, mem))));
			lastText = text;
			var o = office();
			if (typeof o.load === "function") o.load(state); else if (ui && ui.root.style.display !== "none") fallback(state);
		} catch (e) {
			// 비밀번호가 바뀌었거나(새 상자) 받기 실패 — 보던 화면은 두고 알린다
			if (ui) note(e && e.name === "OperationError" ? "상자가 새 비밀번호로 바뀌었습니다. 다시 열어 주세요." : "");
		}
	}
	function lock(reason) {
		if (mem) { mem.gh = ""; mem.priv = null; mem.pw = ""; }
		mem = null; lastText = "";
		clearInterval(timer); timer = 0;
		clearInterval(idleTimer); idleTimer = 0;
		toastHide();
		var o = office();
		if (typeof o.unload === "function") o.unload(typeof reason === "string" ? reason : "");
		if (ui) { ui.list.textContent = ""; hide(); }
	}

	function el(tag, css, txt) {
		var e = document.createElement(tag);
		if (css) e.style.cssText = css;
		if (txt != null) e.textContent = txt;
		return e;
	}
	function build() {
		if (ui) return ui;
		var root = el("div", "position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;" +
			"background:rgba(30,22,14,.55);font-family:Pretendard,system-ui,sans-serif");
		var card = el("form", "background:#F3E7CF;color:#2B2118;border-radius:14px;padding:20px 22px;width:min(92vw,380px);" +
			"max-height:86vh;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.35)");
		var title = el("div", "font-weight:700;font-size:17px;margin-bottom:10px", "내부 화면");
		var input = el("input", "width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #9A7B55;border-radius:8px;background:#FFF9EE");
		input.type = "password"; input.autocomplete = "current-password"; input.placeholder = "비밀번호";
		var row = el("div", "display:flex;gap:8px;margin-top:10px");
		var ok = el("button", "flex:1;padding:10px;font-size:15px;border:0;border-radius:8px;background:#B5452B;color:#fff", "열기");
		ok.type = "submit";
		var x = el("button", "padding:10px 14px;font-size:15px;border:0;border-radius:8px;background:#D8C6A4;color:#2B2118", "닫기");
		x.type = "button";
		var msg = el("div", "min-height:1.3em;margin-top:8px;font-size:14px;color:#9B2B1A");
		var list = el("div", "margin-top:6px;font-size:14px;line-height:1.45");
		row.appendChild(ok); row.appendChild(x);
		[title, input, row, msg, list].forEach(function (n) { card.appendChild(n); });
		root.appendChild(card);
		document.body.appendChild(root);
		card.addEventListener("submit", async function (e) {
			e.preventDefault();
			var pw = input.value;
			input.value = "";
			if (!pw) return;
			ok.disabled = true; msg.textContent = "여는 중…";
			try { await unlock(pw); msg.textContent = ""; }
			catch (err) { msg.textContent = errorText(err); }
			ok.disabled = false; pw = "";
		});
		x.addEventListener("click", function () { if (mem && typeof office().load !== "function") lock(); else hide(); });
		root.addEventListener("keydown", function (e) { if (e.key === "Escape") x.click(); });
		ui = { root: root, input: input, msg: msg, list: list, form: card };
		return ui;
	}
	// 실패 까닭 → 화면 글 (사옥 index 의 비밀번호 칸도 이것을 쓴다)
	function errorText(err) {
		var m = err && err.message;
		if (m === "nobox") return "아직 상자가 없습니다. 팀이 첫 상자를 올린 뒤 다시 들어와 주세요.";
		if (m === "net") return "상자를 받지 못했습니다. 잠시 뒤 다시 해 주세요.";
		if (m === "shape") return "상자 안 내용의 모양이 맞지 않습니다.";
		if (err instanceof TypeError) return "상자를 받지 못했습니다. 잠시 뒤 다시 해 주세요.";   // fetch 망 실패
		return "비밀번호가 맞지 않습니다";
	}
	function note(t) { if (ui) ui.msg.textContent = t; }
	// 알림 띠 (보냈습니다 #12 [되돌리기] 같은 것). 글은 textContent 로만
	var tbox = null, tTimer = 0;
	function toastHide() { clearTimeout(tTimer); if (tbox) tbox.style.display = "none"; }
	function toast(msg, btnText, onBtn, ms) {
		if (typeof document === "undefined") return;
		if (!tbox) {
			tbox = el("div", "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--barh,0px) + 14px);z-index:60;display:none;" +
				"align-items:center;gap:12px;max-width:min(92vw,520px);padding:10px 12px 10px 16px;border-radius:14px;background:#4a3426;color:#fbf5e8;" +
				"font-family:Pretendard,system-ui,sans-serif;font-size:14px;box-shadow:0 8px 22px rgba(60,40,25,.35)");
			tbox.setAttribute("role", "status");
			tbox.id = "officeToast";
			document.body.appendChild(tbox);
		}
		tbox.textContent = "";
		tbox.appendChild(el("span", "flex:1", msg));
		if (btnText) {
			var b = el("button", "border:0;border-radius:999px;background:#e8a93a;color:#3b2a1e;font-weight:800;font-size:14px;padding:6px 14px;cursor:pointer", btnText);
			b.type = "button";
			b.addEventListener("click", function () { toastHide(); onBtn(); });
			tbox.appendChild(b);
		}
		tbox.style.display = "flex";
		clearTimeout(tTimer); tTimer = setTimeout(toastHide, ms || 5000);
	}
	function hide() { if (ui) ui.root.style.display = "none"; }
	function open() {
		if (!subtle) { alert("이 화면은 https 주소에서만 열립니다."); return; }
		build();
		ui.root.style.display = "flex";
		ui.msg.textContent = "";
		ui.input.focus();
	}
	// office.load 가 없을 때만 쓰는 글 목록 (디자인 내부 화면이 들어오기 전 시험용). 글은 textContent 로만 넣는다
	function fallback(state) {
		var L = ui.list;
		L.textContent = "";
		L.appendChild(el("div", "color:#6B5640;margin-bottom:6px", "갱신 " + String(state.updated || "")));
		state.heads.forEach(function (h) {
			var box = el("div", "border-top:1px solid #CDB58C;padding:6px 0");
			box.appendChild(el("div", "font-weight:700", (h.urgent ? "! " : "") + h.id + " · " + (h.status === "work" ? "일하는 중" : h.status === "answering" ? "답하는 중" : "쉬는 중")));
			if (h.task) box.appendChild(el("div", "", h.task));
			if (h.hand) box.appendChild(el("div", "color:#6B5640", "손에 든 것: " + h.hand));
			h.msgs.forEach(function (m) { box.appendChild(el("div", "font-size:13px", "[" + m.from + " " + m.t + "] " + m.text)); });
			var b = el("button", "margin-top:4px;font-size:13px;padding:4px 10px;border:0;border-radius:6px;background:#D8C6A4", "답하기");
			b.type = "button";
			b.addEventListener("click", function () {
				var t = prompt(h.id + " 에게 답 (" + REPLY_MAX + "자까지)\n" + REPLY_NOTE, "");
				if (t) onReply(h.id, t);
			});
			box.appendChild(b);
			L.appendChild(box);
		});
	}

	var api = {
		config: CFG, open: open, lock: lock, unlockWith: unlock, errorText: errorText, onReply: onReply, replyUrl: replyUrl, replyProblem: replyProblem,
		REPLY_MAX: REPLY_MAX, REPLY_NOTE: REPLY_NOTE, BAD: BAD, badIn: badIn, strong: strong, ITER: ITER,
		// 아래는 잠그기 도구(lock_make.html)와 시험이 쓴다
		sealV1: sealV1, openV1: openV1, sealV2: sealV2, openV2: openV2, openBox: openBox,
		makeKeys: makeKeys, unlockPrivate: unlockPrivate, checkState: checkState, b64: b64, unb64: unb64,
		rekeyToken: rekeyToken, checkToken: checkToken, tokenOk: tokenOk, REPO: REPO,
		// 사진 보내기 (보안 07. 개발 30)
		preparePhoto: preparePhoto, photoProblem: photoProblem, photoPath: photoPath, canPhoto: function () { return !!(mem && mem.gh); },
		PHOTO_WARN: PHOTO_WARN, PHOTO_PER_SEND: PHOTO_PER_SEND, PHOTO_DAY_MAX: PHOTO_DAY_MAX, PHOTO_MAX: PHOTO_MAX, PHOTO_SIDE: PHOTO_SIDE
	};
	if (typeof document === "undefined") api.unlockKeyBoxForTest = unlockKeyBox;   // node 시험에서만 (브라우저에는 열지 않음)
	g.OfficeLock = api;
	// office.onReply(headId, text) 를 붙인다. 디자인이 window.office 를 나중에 새로 만들어도 다시 붙인다
	function attach() { office().onReply = onReply; }
	if (typeof document !== "undefined") {
		attach();
		document.addEventListener("DOMContentLoaded", attach);
		g.addEventListener("load", attach);
		// 손댄 때를 적는다 (15분 자동 잠금). 탭을 닫으면 바로 잠근다
		["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (ev) { document.addEventListener(ev, touch, { passive: true, capture: true }); });
		g.addEventListener("pagehide", function () { if (mem) lock(); });
	}
})(typeof window !== "undefined" ? window : globalThis);
